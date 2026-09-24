#import "RNGoogleMobileAdsAdapterFacebook.h"

#import <FBAudienceNetwork/FBAdSettings.h>

@implementation RNGoogleMobileAdsAdapterFacebook

RCT_EXPORT_MODULE();

/**
 * Meta requires advertiser tracking to be set before Google Mobile Ads initialize.
 * Calls FBAdSettings.setAdvertiserTrackingEnabled (FBAudienceNetwork via
 * GoogleMobileAdsMediationFacebook).
 */
RCT_EXPORT_METHOD(setAdvertiserTrackingEnabled : (BOOL)enabled) {
  [FBAdSettings setAdvertiserTrackingEnabled:enabled];
}

RCT_EXPORT_METHOD(setDataProcessingOptions : (NSArray<NSString *> *)options) {
  [FBAdSettings setDataProcessingOptions:options ?: @[]];
}

RCT_EXPORT_METHOD(setDataProcessingOptionsWithLocation
                  : (NSArray<NSString *> *)options country
                  : (double)country state
                  : (double)state) {
  [FBAdSettings setDataProcessingOptions:options ?: @[]
                                 country:(NSInteger)country
                                   state:(NSInteger)state];
}

@end
