#import "RNGMATesting.h"

#import <React/RCTBridgeModule.h>

@implementation RNGMATesting {
  int64_t _debugInventoryTtlMs;
}

RCT_EXPORT_MODULE(NativeRNGMATesting)

- (instancetype)init
{
  if (self = [super init]) {
    _debugInventoryTtlMs = -1;
  }
  return self;
}

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeRNGMATestingSpecJSI>(params);
}

- (void)ping:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  resolve(@"ok:ios");
}

- (void)setDebugInventoryTtlMs:(double)ttlMs
                       resolve:(RCTPromiseResolveBlock)resolve
                        reject:(RCTPromiseRejectBlock)reject
{
  if (ttlMs <= 0) {
    _debugInventoryTtlMs = -1;
  } else {
    _debugInventoryTtlMs = (int64_t)ttlMs;
  }
  resolve(@(YES));
}

- (void)getDebugInventoryTtlMs:(RCTPromiseResolveBlock)resolve
                        reject:(RCTPromiseRejectBlock)reject
{
  resolve(@(_debugInventoryTtlMs));
}

- (void)supportsDelayedBannerAttach:(RCTPromiseResolveBlock)resolve
                             reject:(RCTPromiseRejectBlock)reject
{
  // Classic iOS documents delayed first insertion; detach/reparent after display remains out of scope.
  resolve(@(YES));
}

static NSString *RNGMATestingResponseInfoFixture(NSString *kind)
{
  if ([kind isEqualToString:@"loaded"]) {
    return @"{\"responseId\":\"fixture-loaded-response\",\"adapterClassName\":\"GADMAdapterGoogleAdMobAds\",\"loadedAdapterResponse\":{\"adapterClassName\":\"GADMAdapterGoogleAdMobAds\",\"adSourceName\":\"AdMob Network\",\"adSourceId\":\"fixture-source\",\"adSourceInstanceName\":null,\"adSourceInstanceId\":null,\"latencyMillis\":42,\"outcome\":\"success\",\"adError\":null},\"adapterResponses\":[{\"adapterClassName\":\"GADMAdapterGoogleAdMobAds\",\"adSourceName\":\"AdMob Network\",\"adSourceId\":\"fixture-source\",\"adSourceInstanceName\":null,\"adSourceInstanceId\":null,\"latencyMillis\":42,\"outcome\":\"success\",\"adError\":null}],\"extras\":{\"creativeId\":\"fixture-creative\"}}";
  }
  if ([kind isEqualToString:@"no-fill"]) {
    return @"{\"responseId\":null,\"adapterClassName\":null,\"loadedAdapterResponse\":null,\"adapterResponses\":[{\"adapterClassName\":\"GADMAdapterGoogleAdMobAds\",\"adSourceName\":\"AdMob Network\",\"adSourceId\":\"fixture-source\",\"adSourceInstanceName\":null,\"adSourceInstanceId\":null,\"latencyMillis\":18,\"outcome\":\"error\",\"adError\":{\"code\":1,\"message\":\"Request Error: No ad to show.\"}}],\"extras\":{}}";
  }
  if ([kind isEqualToString:@"paid-compact"]) {
    return @"{\"responseId\":\"fixture-paid-response\",\"adapterClassName\":\"GADMAdapterGoogleAdMobAds\",\"loadedAdapterResponse\":{\"adapterClassName\":\"GADMAdapterGoogleAdMobAds\",\"adSourceName\":\"AdMob Network\",\"adSourceId\":\"fixture-source\",\"adSourceInstanceName\":null,\"adSourceInstanceId\":null,\"latencyMillis\":42,\"outcome\":\"success\",\"adError\":null},\"extras\":{\"creativeId\":\"fixture-creative\"}}";
  }
  return nil;
}

- (void)getResponseInfoFixtureJson:(NSString *)kind
                           resolve:(RCTPromiseResolveBlock)resolve
                            reject:(RCTPromiseRejectBlock)reject
{
  NSString *json = RNGMATestingResponseInfoFixture(kind);
  if (json == nil) {
    reject(
        @"rngma-testing/unknown-fixture",
        [NSString stringWithFormat:@"Unknown ResponseInfo fixture kind: %@ (expected loaded|no-fill|paid-compact)",
                                   kind],
        nil);
    return;
  }
  resolve(json);
}

@end
