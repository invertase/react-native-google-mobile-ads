#import "RNGMALiveRampAtsEnvelopeManager.h"

#import <CommonCrypto/CommonDigest.h>

static NSString *const kPrefs = @"rngma_liveramp_ats";

@implementation RNGMALiveRampAtsEnvelopeRecord
- (NSString *)signalForCollect {
  if (self.envelope27.length > 0) {
    return self.envelope27;
  }
  if (self.envelope19.length > 0) {
    return self.envelope19;
  }
  return @"";
}
@end

@interface RNGMALiveRampAtsEnvelopeManager ()
@property (nonatomic, strong) dispatch_queue_t workerQueue;
@property (nonatomic, copy, nullable) NSString *bundleId;
@property (nonatomic, assign) NSInteger placementId;
@property (nonatomic, copy, nullable) NSString *pendingEmail;
@property (nonatomic, copy, nullable) NSString *pendingPhone;
@property (nonatomic, strong, nullable) RNGMALiveRampAtsEnvelopeRecord *cache;
@end

@implementation RNGMALiveRampAtsEnvelopeManager

+ (instancetype)sharedManager {
  static RNGMALiveRampAtsEnvelopeManager *instance;
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    instance = [RNGMALiveRampAtsEnvelopeManager new];
    instance.workerQueue = dispatch_queue_create("rngma.liveramp.ats", DISPATCH_QUEUE_SERIAL);
    instance.bundleId = [[NSBundle mainBundle] bundleIdentifier];
  });
  return instance;
}

- (void)hydrateIfNeeded {
  if (self.cache != nil) {
    return;
  }
  [self reloadFromDefaults];
}

+ (NSString *)cachedSignal {
  [[RNGMALiveRampAtsEnvelopeManager sharedManager] hydrateIfNeeded];
  RNGMALiveRampAtsEnvelopeRecord *record = [RNGMALiveRampAtsEnvelopeManager sharedManager].cache;
  return record ? [record signalForCollect] : @"";
}

- (nullable RNGMALiveRampAtsEnvelopeRecord *)currentRecord {
  [self hydrateIfNeeded];
  return self.cache;
}

- (void)configureWithPlacementId:(NSInteger)placementId bundleId:(nullable NSString *)bundleId {
  self.placementId = placementId;
  if (bundleId.length > 0) {
    self.bundleId = bundleId;
  }
  NSUserDefaults *prefs = [NSUserDefaults standardUserDefaults];
  [prefs setInteger:placementId forKey:[NSString stringWithFormat:@"%@.pid", kPrefs]];
  [prefs setObject:[self originHeader] forKey:[NSString stringWithFormat:@"%@.origin", kPrefs]];
  [prefs synchronize];
  [self reloadFromDefaults];
  __weak typeof(self) weakSelf = self;
  dispatch_async(self.workerQueue, ^{
    [weakSelf refreshIfPossible];
  });
}

- (void)setEmail:(nullable NSString *)email phone:(nullable NSString *)phone {
  self.pendingEmail = email;
  self.pendingPhone = phone;
  __weak typeof(self) weakSelf = self;
  dispatch_async(self.workerQueue, ^{
    [weakSelf fetchAfterIdentifierSet];
  });
}

- (void)clearIdentifier {
  self.pendingEmail = nil;
  self.pendingPhone = nil;
  NSUserDefaults *prefs = [NSUserDefaults standardUserDefaults];
  for (NSString *key in @[
         [NSString stringWithFormat:@"%@.e27", kPrefs], [NSString stringWithFormat:@"%@.e19", kPrefs],
         [NSString stringWithFormat:@"%@.e25", kPrefs], [NSString stringWithFormat:@"%@.created", kPrefs],
         [NSString stringWithFormat:@"%@.refresh", kPrefs]
       ]) {
    [prefs removeObjectForKey:key];
  }
  [prefs synchronize];
  [self reloadFromDefaults];
}

#pragma mark - Storage

- (void)reloadFromDefaults {
  NSUserDefaults *prefs = [NSUserDefaults standardUserDefaults];
  RNGMALiveRampAtsEnvelopeRecord *record = [RNGMALiveRampAtsEnvelopeRecord new];
  record.envelope27 = [prefs stringForKey:[NSString stringWithFormat:@"%@.e27", kPrefs]];
  record.envelope19 = [prefs stringForKey:[NSString stringWithFormat:@"%@.e19", kPrefs]];
  record.envelope25 = [prefs stringForKey:[NSString stringWithFormat:@"%@.e25", kPrefs]];
  record.placementId = [prefs integerForKey:[NSString stringWithFormat:@"%@.pid", kPrefs]];
  record.origin = [prefs stringForKey:[NSString stringWithFormat:@"%@.origin", kPrefs]];
  self.cache = record;
}

- (void)persistEnvelopes27:(nullable NSString *)e27 e19:(nullable NSString *)e19 e25:(nullable NSString *)e25 {
  NSUserDefaults *prefs = [NSUserDefaults standardUserDefaults];
  if (e27.length > 0) {
    [prefs setObject:e27 forKey:[NSString stringWithFormat:@"%@.e27", kPrefs]];
  } else {
    [prefs removeObjectForKey:[NSString stringWithFormat:@"%@.e27", kPrefs]];
  }
  if (e19.length > 0) {
    [prefs setObject:e19 forKey:[NSString stringWithFormat:@"%@.e19", kPrefs]];
  } else {
    [prefs removeObjectForKey:[NSString stringWithFormat:@"%@.e19", kPrefs]];
  }
  if (e25.length > 0) {
    [prefs setObject:e25 forKey:[NSString stringWithFormat:@"%@.e25", kPrefs]];
  } else {
    [prefs removeObjectForKey:[NSString stringWithFormat:@"%@.e25", kPrefs]];
  }
  NSTimeInterval now = [[NSDate date] timeIntervalSince1970] * 1000.0;
  [prefs setDouble:now forKey:[NSString stringWithFormat:@"%@.refresh", kPrefs]];
  if ([prefs objectForKey:[NSString stringWithFormat:@"%@.created", kPrefs]] == nil) {
    [prefs setDouble:now forKey:[NSString stringWithFormat:@"%@.created", kPrefs]];
  }
  [prefs synchronize];
  [self reloadFromDefaults];
}

#pragma mark - HTTP

- (void)fetchAfterIdentifierSet {
  if (self.placementId <= 0) {
    return;
  }
  NSString *hash = nil;
  NSInteger it = 4;
  if (self.pendingEmail.length > 0) {
    hash = [self sha256Hex:[self normalizeEmail:self.pendingEmail]];
    it = 4;
  } else if (self.pendingPhone.length > 0) {
    hash = [self sha256Hex:[self normalizePhone:self.pendingPhone]];
    it = 11;
  }
  if (hash.length == 0) {
    return;
  }
  NSString *url =
      [NSString stringWithFormat:
                    @"https://api.rlcdn.com/api/identity/v2/envelope?pid=%ld&it=%ld&iv=%@&atype=2",
                    (long)self.placementId, (long)it, [self urlEncode:hash]];
  NSString *tc = [self consentTcString];
  if (tc.length > 0) {
    url = [NSString stringWithFormat:@"%@&ct=4&cv=%@", url, [self urlEncode:tc]];
  }
  [self performGET:url applyBody:YES];
}

- (void)refreshIfPossible {
  NSString *e19 = self.cache.envelope19;
  if (e19.length == 0) {
    if (self.pendingEmail.length > 0 || self.pendingPhone.length > 0) {
      [self fetchAfterIdentifierSet];
    }
    return;
  }
  NSString *url = [NSString
      stringWithFormat:@"https://api.rlcdn.com/api/identity/v2/envelope/refresh?pid=%ld&it=19&iv=%@"
                       @"&atype=2",
                       (long)self.placementId, [self urlEncode:e19]];
  NSString *tc = [self consentTcString];
  if (tc.length > 0) {
    url = [NSString stringWithFormat:@"%@&ct=4&cv=%@", url, [self urlEncode:tc]];
  }
  [self performGET:url applyBody:YES];
}

- (void)performGET:(NSString *)urlString applyBody:(BOOL)applyBody {
  NSURL *url = [NSURL URLWithString:urlString];
  if (!url) {
    return;
  }
  NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:url];
  request.HTTPMethod = @"GET";
  [request setValue:[self originHeader] forHTTPHeaderField:@"Origin"];
  [request setValue:@"application/json" forHTTPHeaderField:@"Accept"];

  dispatch_semaphore_t sem = dispatch_semaphore_create(0);
  __block NSData *data = nil;
  __block NSHTTPURLResponse *response = nil;
  [[[NSURLSession sharedSession] dataTaskWithRequest:request
                                   completionHandler:^(NSData *taskData, NSURLResponse *taskResponse, NSError *error) {
                                     data = taskData;
                                     response = (NSHTTPURLResponse *)taskResponse;
                                     dispatch_semaphore_signal(sem);
                                   }] resume];
  dispatch_semaphore_wait(sem, DISPATCH_TIME_FOREVER);

  if (!applyBody || response == nil) {
    return;
  }
  NSInteger code = response.statusCode;
  if (code == 204) {
    [self clearIdentifier];
    return;
  }
  if (code != 200) {
    return;
  }
  NSDictionary *json = [NSJSONSerialization JSONObjectWithData:data options:0 error:nil];
  if (![json isKindOfClass:[NSDictionary class]]) {
    return;
  }
  NSArray *envelopes = json[@"envelopes"];
  if (![envelopes isKindOfClass:[NSArray class]]) {
    return;
  }
  NSString *e27 = nil, *e19 = nil, *e25 = nil;
  for (id item in envelopes) {
    if (![item isKindOfClass:[NSDictionary class]]) {
      continue;
    }
    NSNumber *type = item[@"type"];
    NSString *value = item[@"value"];
    if (value.length == 0) {
      continue;
    }
    switch (type.intValue) {
      case 27:
        e27 = value;
        break;
      case 19:
        e19 = value;
        break;
      case 25:
        e25 = value;
        break;
      default:
        break;
    }
  }
  [self persistEnvelopes27:e27 e19:e19 e25:e25];
}

#pragma mark - Helpers

- (NSString *)originHeader {
  NSString *bundle = self.bundleId ?: [[NSBundle mainBundle] bundleIdentifier];
  return [NSString stringWithFormat:@"https://%@", bundle];
}

- (BOOL)gdprApplies {
  NSUserDefaults *defaults = [NSUserDefaults standardUserDefaults];
  id raw = [defaults objectForKey:@"IABTCF_gdprApplies"];
  if ([raw isKindOfClass:[NSNumber class]]) {
    return [(NSNumber *)raw intValue] == 1;
  }
  if ([raw isKindOfClass:[NSString class]]) {
    return [(NSString *)raw isEqualToString:@"1"];
  }
  return NO;
}

- (nullable NSString *)consentTcString {
  if (![self gdprApplies]) {
    return nil;
  }
  return [[NSUserDefaults standardUserDefaults] stringForKey:@"IABTCF_TCString"];
}

- (NSString *)normalizeEmail:(NSString *)email {
  NSString *cleaned = [[email stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]]
      lowercaseString];
  NSArray<NSString *> *parts = [cleaned componentsSeparatedByString:@"@"];
  if (parts.count != 2) {
    return cleaned;
  }
  NSString *local = parts[0];
  NSRange plus = [local rangeOfString:@"+"];
  if (plus.location != NSNotFound) {
    local = [local substringToIndex:plus.location];
  }
  NSString *domain = parts[1];
  if ([domain isEqualToString:@"gmail.com"]) {
    local = [local stringByReplacingOccurrencesOfString:@"." withString:@""];
  }
  return [NSString stringWithFormat:@"%@@%@", local, domain];
}

- (NSString *)normalizePhone:(NSString *)phone {
  NSCharacterSet *nonDigits =
      [[NSCharacterSet decimalDigitCharacterSet] invertedSet];
  NSString *digits = [[phone stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]]
      componentsSeparatedByCharactersInSet:nonDigits];
  digits = [digits componentsJoinedByString:@""];
  while ([digits hasPrefix:@"0"] && digits.length > 1) {
    digits = [digits substringFromIndex:1];
  }
  return digits;
}

- (nullable NSString *)sha256Hex:(NSString *)value {
  NSData *data = [value dataUsingEncoding:NSUTF8StringEncoding];
  unsigned char digest[CC_SHA256_DIGEST_LENGTH];
  CC_SHA256(data.bytes, (CC_LONG)data.length, digest);
  NSMutableString *hex = [NSMutableString stringWithCapacity:CC_SHA256_DIGEST_LENGTH * 2];
  for (int i = 0; i < CC_SHA256_DIGEST_LENGTH; i++) {
    [hex appendFormat:@"%02x", digest[i]];
  }
  return hex;
}

- (NSString *)urlEncode:(NSString *)value {
  return [value stringByAddingPercentEncodingWithAllowedCharacters:[NSCharacterSet URLQueryAllowedCharacterSet]] ?: value;
}

@end