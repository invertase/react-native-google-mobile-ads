// This guard prevent this file to be compiled in the old architecture.
#ifdef RCT_NEW_ARCH_ENABLED
#import <GoogleMobileAds/GADAppEventDelegate.h>
#import <GoogleMobileAds/GADBannerView.h>
#import <GoogleMobileAds/GADBannerViewDelegate.h>
#import <React/RCTViewComponentView.h>
#import <UIKit/UIKit.h>

#ifndef NativeComponentExampleComponentView_h
#define NativeComponentExampleComponentView_h

NS_ASSUME_NONNULL_BEGIN

@interface RNGoogleMobileAdsBannerView
    : RCTViewComponentView <GADBannerViewDelegate, GADAppEventDelegate>

@property GADBannerView *banner;
@property(nonatomic, assign) BOOL requested;

@property(nonatomic, copy) NSArray *sizes;
@property(nonatomic, copy) NSString *unitId;
@property(nonatomic, copy) NSDictionary *request;
@property(nonatomic, copy) NSNumber *manualImpressionsEnabled;

@end

NS_ASSUME_NONNULL_END

#endif /* NativeComponentExampleComponentView_h */
#endif /* RCT_NEW_ARCH_ENABLED */
