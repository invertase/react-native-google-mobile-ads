// This guard prevent the code from being compiled in the old architecture
#ifdef RCT_NEW_ARCH_ENABLED
#import "RNGoogleMobileAdsBannerView.h"
#import "RNGoogleMobileAdsCommon.h"

#import <react/renderer/components/RNGoogleMobileAdsSpec/ComponentDescriptors.h>
#import <react/renderer/components/RNGoogleMobileAdsSpec/EventEmitters.h>
#import <react/renderer/components/RNGoogleMobileAdsSpec/Props.h>
#import <react/renderer/components/RNGoogleMobileAdsSpec/RCTComponentViewHelpers.h>

#import "RCTFabricComponentsPlugins.h"

using namespace facebook::react;

@interface RNGoogleMobileAdsBannerView () <RCTRNGoogleMobileAdsBannerViewViewProtocol>

@end

@implementation RNGoogleMobileAdsBannerView

+ (ComponentDescriptorProvider)componentDescriptorProvider {
  return concreteComponentDescriptorProvider<RNGoogleMobileAdsBannerViewComponentDescriptor>();
}

- (instancetype)initWithFrame:(CGRect)frame {
  if (self = [super initWithFrame:frame]) {
    static const auto defaultProps = std::make_shared<const RNGoogleMobileAdsBannerViewProps>();
    _props = defaultProps;
  }

  return self;
}

- (void)prepareForRecycle {
  [super prepareForRecycle];
  static const auto defaultProps = std::make_shared<const RNGoogleMobileAdsBannerViewProps>();
  _props = defaultProps;
}

- (void)updateProps:(Props::Shared const &)props oldProps:(Props::Shared const &)oldProps {
  const auto &oldViewProps =
      *std::static_pointer_cast<RNGoogleMobileAdsBannerViewProps const>(_props);
  const auto &newViewProps =
      *std::static_pointer_cast<RNGoogleMobileAdsBannerViewProps const>(props);

  BOOL propsChanged = false;

  if (oldViewProps.unitId != newViewProps.unitId) {
    _unitId = [[NSString alloc] initWithUTF8String:newViewProps.unitId.c_str()];
    propsChanged = true;
  }

  if (oldViewProps.sizes != newViewProps.sizes) {
    NSMutableArray *adSizes = [NSMutableArray arrayWithCapacity:newViewProps.sizes.size()];
    for (auto i = 0; i < newViewProps.sizes.size(); i++) {
      NSString *jsonValue = [[NSString alloc] initWithUTF8String:newViewProps.sizes[i].c_str()];
      GADAdSize adSize = [RNGoogleMobileAdsCommon stringToAdSize:jsonValue];
      if (GADAdSizeEqualToSize(adSize, GADAdSizeInvalid)) {
        RCTLogWarn(@"Invalid adSize %@", jsonValue);
      } else {
        [adSizes addObject:NSValueFromGADAdSize(adSize)];
      }
    }
    _sizes = adSizes;
    propsChanged = true;
  }

  if (_request == nil) {
    _request = [NSDictionary dictionary];
  }
  if (oldViewProps.request != newViewProps.request) {
    NSString *jsonString = [[NSString alloc] initWithUTF8String:newViewProps.request.c_str()];
    NSData *jsonData = [jsonString dataUsingEncoding:NSUTF8StringEncoding];
    NSError *error = nil;
    _request = [NSJSONSerialization JSONObjectWithData:jsonData options:kNilOptions error:&error];
    if (error) {
      NSLog(@"Error parsing JSON: %@", error.localizedDescription);
    }
    propsChanged = true;
  }

  if (_manualImpressionsEnabled == nil) {
    _manualImpressionsEnabled = [NSNumber numberWithBool:oldViewProps.manualImpressionsEnabled];
  }
  if (oldViewProps.manualImpressionsEnabled != newViewProps.manualImpressionsEnabled) {
    _manualImpressionsEnabled = [NSNumber numberWithBool:newViewProps.manualImpressionsEnabled];
    propsChanged = true;
  }

  if (propsChanged) {
    [self requestAd];
  }

  [super updateProps:props oldProps:oldProps];
}

#pragma mark - Methods

- (void)initBanner:(GADAdSize)adSize {
  if (_requested) {
    [_banner removeFromSuperview];
  }
  if ([RNGoogleMobileAdsCommon isAdManagerUnit:_unitId]) {
    _banner = [[GAMBannerView alloc] initWithAdSize:adSize];

    ((GAMBannerView *)_banner).validAdSizes = _sizes;
    ((GAMBannerView *)_banner).appEventDelegate = self;
    ((GAMBannerView *)_banner).enableManualImpressions = [_manualImpressionsEnabled boolValue];
  } else {
    _banner = [[GADBannerView alloc] initWithAdSize:adSize];
  }
  _banner.paidEventHandler = ^(GADAdValue *_Nonnull value) {
    std::dynamic_pointer_cast<const facebook::react::RNGoogleMobileAdsBannerViewEventEmitter>(
        _eventEmitter)
        ->onNativeEvent(facebook::react::RNGoogleMobileAdsBannerViewEventEmitter::OnNativeEvent {
          .type = "onPaid", .value = value.value.doubleValue,
          .precision = @(value.precision).doubleValue, .currency = value.currencyCode.UTF8String
        });
  };
  _banner.rootViewController = [UIApplication sharedApplication].delegate.window.rootViewController;
  _banner.delegate = self;
}

- (void)requestAd {
#ifndef __LP64__
  return;  // prevent crash on 32bit
#endif

  if (_unitId == nil || _sizes == nil || _request == nil || _manualImpressionsEnabled == nil) {
    [self setRequested:NO];
    return;
  } else {
    [self initBanner:GADAdSizeFromNSValue(_sizes[0])];
    [self addSubview:_banner];
    _banner.adUnitID = _unitId;
    [self setRequested:YES];
    [_banner loadRequest:[RNGoogleMobileAdsCommon buildAdRequest:_request]];
    if (_eventEmitter != nullptr) {
      std::dynamic_pointer_cast<const facebook::react::RNGoogleMobileAdsBannerViewEventEmitter>(
          _eventEmitter)
          ->onNativeEvent(facebook::react::RNGoogleMobileAdsBannerViewEventEmitter::OnNativeEvent{
              .type = "onSizeChange",
              .width = _banner.bounds.size.width,
              .height = _banner.bounds.size.height});
    }
  }
}

- (void)handleCommand:(const NSString *)commandName args:(const NSArray *)args {
  if ([commandName isEqual:@"recordManualImpression"]) {
    [self recordManualImpression];
  }
}

- (void)recordManualImpression {
  if ([_banner class] == [GAMBannerView class]) {
    [((GAMBannerView *)_banner) recordImpression];
  }
}

#pragma mark - Events

- (void)bannerViewDidReceiveAd:(GADBannerView *)bannerView {
  if (_eventEmitter != nullptr) {
    std::dynamic_pointer_cast<const facebook::react::RNGoogleMobileAdsBannerViewEventEmitter>(
        _eventEmitter)
        ->onNativeEvent(facebook::react::RNGoogleMobileAdsBannerViewEventEmitter::OnNativeEvent{
            .type = "onAdLoaded",
            .width = bannerView.bounds.size.width,
            .height = bannerView.bounds.size.height});
  }
}

- (void)bannerView:(GADBannerView *)bannerView didFailToReceiveAdWithError:(NSError *)error {
  NSDictionary *errorAndMessage = [RNGoogleMobileAdsCommon getCodeAndMessageFromAdError:error];
  if (_eventEmitter != nullptr) {
    std::dynamic_pointer_cast<const facebook::react::RNGoogleMobileAdsBannerViewEventEmitter>(
        _eventEmitter)
        ->onNativeEvent(facebook::react::RNGoogleMobileAdsBannerViewEventEmitter::OnNativeEvent{
            .type = "onAdFailedToLoad",
            .code = std::string([[errorAndMessage valueForKey:@"code"] UTF8String]),
            .message = std::string([[errorAndMessage valueForKey:@"message"] UTF8String])});
  }
}

- (void)bannerViewWillPresentScreen:(GADBannerView *)bannerView {
  if (_eventEmitter != nullptr) {
    std::dynamic_pointer_cast<const facebook::react::RNGoogleMobileAdsBannerViewEventEmitter>(
        _eventEmitter)
        ->onNativeEvent(facebook::react::RNGoogleMobileAdsBannerViewEventEmitter::OnNativeEvent{
            .type = "onAdOpened"});
  }
}

- (void)bannerViewWillDismissScreen:(GADBannerView *)bannerView {
  // not in use
}

- (void)bannerViewDidDismissScreen:(GADBannerView *)bannerView {
  if (_eventEmitter != nullptr) {
    std::dynamic_pointer_cast<const facebook::react::RNGoogleMobileAdsBannerViewEventEmitter>(
        _eventEmitter)
        ->onNativeEvent(facebook::react::RNGoogleMobileAdsBannerViewEventEmitter::OnNativeEvent{
            .type = "onAdClosed"});
  }
}

- (void)adView:(nonnull GADBannerView *)banner
    didReceiveAppEvent:(nonnull NSString *)name
              withInfo:(nullable NSString *)info {
  if (_eventEmitter != nullptr) {
    std::dynamic_pointer_cast<const facebook::react::RNGoogleMobileAdsBannerViewEventEmitter>(
        _eventEmitter)
        ->onNativeEvent(facebook::react::RNGoogleMobileAdsBannerViewEventEmitter::OnNativeEvent{
            .type = "onAppEvent",
            .name = std::string([name UTF8String]),
            .data = std::string([info UTF8String])});
  }
}

#pragma mark - RNGoogleMobileAdsBannerViewCls

Class<RCTComponentViewProtocol> RNGoogleMobileAdsBannerViewCls(void) {
  return RNGoogleMobileAdsBannerView.class;
}

@end
#endif
