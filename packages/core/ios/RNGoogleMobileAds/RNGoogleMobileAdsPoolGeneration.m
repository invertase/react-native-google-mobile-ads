#import "RNGoogleMobileAdsPoolGeneration.h"

@interface RNGoogleMobileAdsPoolGeneration ()
@property(nonatomic, strong) NSMutableDictionary<NSString *, NSNumber *> *latest;
@property(nonatomic, strong) NSMutableSet<NSString *> *active;
@end

@implementation RNGoogleMobileAdsPoolGeneration

- (instancetype)init {
  if (self = [super init]) {
    _latest = [NSMutableDictionary new];
    _active = [NSMutableSet new];
  }
  return self;
}

- (BOOL)claimStartForKey:(NSString *)key generation:(NSNumber *)generation {
  NSNumber *latest = self.latest[key];
  if (latest != nil && [latest compare:generation] != NSOrderedAscending) {
    return NO;
  }
  self.latest[key] = generation;
  [self.active addObject:key];
  return YES;
}

- (BOOL)allowsOperationForKey:(NSString *)key generation:(NSNumber *)generation {
  return [self.active containsObject:key] && [self.latest[key] isEqualToNumber:generation];
}

- (BOOL)releaseDestroyForKey:(NSString *)key generation:(NSNumber *)generation {
  if (![self allowsOperationForKey:key generation:generation]) {
    return NO;
  }
  [self.active removeObject:key];
  return YES;
}

@end
