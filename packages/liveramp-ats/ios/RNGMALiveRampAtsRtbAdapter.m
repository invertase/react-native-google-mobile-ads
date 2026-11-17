#import <GoogleMobileAds/GoogleMobileAds.h>

#import "RNGMALiveRampAtsEnvelopeManager.h"

#ifndef LR_ATS_PACKAGE_VERSION
#define LR_ATS_PACKAGE_VERSION @"0.0.0"
#endif
#ifndef LR_ATS_ENVELOPE_API_VERSION
#define LR_ATS_ENVELOPE_API_VERSION @"2.0.0"
#endif

@interface RNGMALiveRampAtsRtbAdapter : NSObject <GADRTBAdapter>
@end

@implementation RNGMALiveRampAtsRtbAdapter

+ (GADVersionNumber)adSDKVersion {
  return [self versionFromString:LR_ATS_ENVELOPE_API_VERSION];
}

+ (GADVersionNumber)adapterVersion {
  return [self versionFromString:LR_ATS_PACKAGE_VERSION];
}

+ (Class<GADAdNetworkExtras>)networkExtrasClass {
  return Nil;
}

+ (void)setUpWithConfiguration:(GADMediationServerConfiguration *)configuration
             completionHandler:(GADMediationAdapterSetUpCompletionBlock)completionHandler {
  [[RNGMALiveRampAtsEnvelopeManager sharedManager] hydrateIfNeeded];
  completionHandler(nil);
}

- (void)collectSignalsForRequestParameters:(GADRTBRequestParameters *)params
                       completionHandler:(GADRTBSignalCompletionHandler)completionHandler {
  NSString *signal = [RNGMALiveRampAtsEnvelopeManager cachedSignal];
  completionHandler(signal ?: @"", nil);
}

+ (GADVersionNumber)versionFromString:(NSString *)version {
  NSArray<NSString *> *parts = [version componentsSeparatedByString:@"."];
  GADVersionNumber number = {0, 0, 0};
  if (parts.count > 0) {
    number.majorVersion = parts[0].integerValue;
  }
  if (parts.count > 1) {
    number.minorVersion = parts[1].integerValue;
  }
  if (parts.count > 2) {
    number.patchVersion = parts[2].integerValue;
  }
  return number;
}

@end