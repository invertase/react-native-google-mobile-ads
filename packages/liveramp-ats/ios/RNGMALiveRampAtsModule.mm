#import <React/RCTBridgeModule.h>

#import "RNGMALiveRampAtsEnvelopeManager.h"

@interface RNGMALiveRampAtsModule : NSObject <RCTBridgeModule>
@end

@implementation RNGMALiveRampAtsModule

RCT_EXPORT_MODULE(RNGMALiveRampAtsModule);

+ (BOOL)requiresMainQueueSetup {
  return NO;
}

RCT_EXPORT_METHOD(configure : (NSDictionary *)options resolve : (RCTPromiseResolveBlock)resolve reject : (RCTPromiseRejectBlock)reject) {
  NSNumber *placementId = options[@"placementId"];
  if (placementId == nil) {
    reject(@"EINVAL", @"configure requires placementId", nil);
    return;
  }
  NSString *bundleId = options[@"bundleId"];
  [[RNGMALiveRampAtsEnvelopeManager sharedManager] configureWithPlacementId:placementId.integerValue
                                                                   bundleId:bundleId];
  resolve(nil);
}

RCT_EXPORT_METHOD(setIdentifier : (NSDictionary *)options resolve : (RCTPromiseResolveBlock)resolve reject : (RCTPromiseRejectBlock)reject) {
  [[RNGMALiveRampAtsEnvelopeManager sharedManager] setEmail:options[@"email"] phone:options[@"phone"]];
  resolve(nil);
}

RCT_EXPORT_METHOD(clearIdentifier : (RCTPromiseResolveBlock)resolve reject : (RCTPromiseRejectBlock)reject) {
  [[RNGMALiveRampAtsEnvelopeManager sharedManager] clearIdentifier];
  resolve(nil);
}

RCT_EXPORT_METHOD(getEnvelope : (RCTPromiseResolveBlock)resolve reject : (RCTPromiseRejectBlock)reject) {
  RNGMALiveRampAtsEnvelopeRecord *record = [[RNGMALiveRampAtsEnvelopeManager sharedManager] currentRecord];
  if (record == nil) {
    resolve(@{
      @"envelope27" : [NSNull null],
      @"envelope19" : [NSNull null],
      @"envelope25" : [NSNull null],
      @"signal" : @"",
      @"placementId" : [NSNull null],
      @"origin" : [NSNull null]
    });
    return;
  }
  resolve(@{
    @"envelope27" : record.envelope27 ?: [NSNull null],
    @"envelope19" : record.envelope19 ?: [NSNull null],
    @"envelope25" : record.envelope25 ?: [NSNull null],
    @"signal" : [record signalForCollect],
    @"placementId" : @(record.placementId),
    @"origin" : record.origin ?: [NSNull null]
  });
}

@end