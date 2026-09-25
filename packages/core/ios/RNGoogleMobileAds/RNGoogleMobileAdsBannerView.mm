#if !TARGET_OS_MACCATALYST

// This guard prevent the code from being compiled in the old architecture
#ifdef RCT_NEW_ARCH_ENABLED
#import "RNGoogleMobileAdsBannerView.h"
#import "RNGoogleMobileAdsBannerEventMapping.h"
#import "RNGoogleMobileAdsCommon.h"
#import "RNGoogleMobileAdsResponseInfo.h"

#import <GoogleMobileAds/GAMBannerView.h>
#import <RNGoogleMobileAdsSpec/ComponentDescriptors.h>
#import <RNGoogleMobileAdsSpec/EventEmitters.h>
#import <RNGoogleMobileAdsSpec/Props.h>
#import <RNGoogleMobileAdsSpec/RCTComponentViewHelpers.h>

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

  [self destroyBanner];
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

  if (oldViewProps.sizeConfig.sizes != newViewProps.sizeConfig.sizes ||
      oldViewProps.sizeConfig.maxHeight != newViewProps.sizeConfig.maxHeight ||
      oldViewProps.sizeConfig.width != newViewProps.sizeConfig.width) {
    NSMutableArray *adSizes =
        [NSMutableArray arrayWithCapacity:newViewProps.sizeConfig.sizes.size()];
    CGFloat maxAdHeight =
        newViewProps.sizeConfig.maxHeight > 0 ? newViewProps.sizeConfig.maxHeight : -1;
    CGFloat width = newViewProps.sizeConfig.width > 0 ? newViewProps.sizeConfig.width : -1;
    for (auto i = 0; i < newViewProps.sizeConfig.sizes.size(); i++) {
      NSString *jsonValue =
          [[NSString alloc] initWithUTF8String:newViewProps.sizeConfig.sizes[i].c_str()];
      GADAdSize adSize = [RNGoogleMobileAdsCommon stringToAdSize:jsonValue
                                                   withMaxHeight:maxAdHeight
                                                        andWidth:width];
      if (GADAdSizeEqualToSize(adSize, GADAdSizeInvalid)) {
        RCTLogWarn(@"Invalid adSize %@", jsonValue);
      } else {
        [adSizes addObject:NSValueFromGADAdSize(adSize)];
      }
    }
    _sizeConfig = @{
      @"sizes" : adSizes,
      @"maxHeight" : [NSNumber numberWithFloat:maxAdHeight],
      @"width" : [NSNumber numberWithFloat:width]
    };
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

- (void)dealloc {
  [self destroyBanner];
}

#pragma mark - Methods

- (void)destroyBanner {
  if (_banner == nil) {
    return;
  }
  // #540: clear copy-retained paidEventHandler before releasing the banner so
  // a strong capture cannot keep the Fabric view + WKWebView creative alive.
  _banner.paidEventHandler = nil;
  _banner.delegate = nil;
  if ([_banner isKindOfClass:[GAMBannerView class]]) {
    ((GAMBannerView *)_banner).appEventDelegate = nil;
  }
  [_banner removeFromSuperview];
  _banner = nil;
}

- (void)initBanner:(GADAdSize)adSize {
  if (_requested) {
    [self destroyBanner];
  }
  if ([RNGoogleMobileAdsCommon isAdManagerUnit:_unitId]) {
    _banner = [[GAMBannerView alloc] initWithAdSize:adSize];

    ((GAMBannerView *)_banner).validAdSizes = _sizeConfig[@"sizes"];
    ((GAMBannerView *)_banner).appEventDelegate = self;
    ((GAMBannerView *)_banner).enableManualImpressions = [_manualImpressionsEnabled boolValue];
  } else {
    _banner = [[GADBannerView alloc] initWithAdSize:adSize];
  }
  // #540: GADBannerView.paidEventHandler is `copy`. Strongly capturing self
  // (via _banner / _eventEmitter ivars) retains owner → banner → block → owner
  // and leaks list banners on real devices. Match paper BannerComponent.
  __weak __typeof(self) weakSelf = self;
  _banner.paidEventHandler = ^(GADAdValue *_Nonnull value) {
    __strong __typeof(weakSelf) strongSelf = weakSelf;
    if (strongSelf == nil || strongSelf->_eventEmitter == nullptr || strongSelf->_banner == nil) {
      return;
    }
    NSDictionary *paid = [RNGoogleMobileAdsResponseInfo
        paidEventPayloadFromAdValue:value
                       responseInfo:strongSelf->_banner.responseInfo];
    NSString *responseInfoJson = nil;
    id compact = paid[@"responseInfo"];
    if ([compact isKindOfClass:[NSDictionary class]]) {
      NSData *jsonData = [NSJSONSerialization dataWithJSONObject:compact options:0 error:nil];
      if (jsonData != nil) {
        responseInfoJson = [[NSString alloc] initWithData:jsonData encoding:NSUTF8StringEncoding];
      }
    }
    std::string responseInfoJsonStd =
        responseInfoJson != nil ? std::string([responseInfoJson UTF8String]) : "";
    // iOS has no exact micros (see paidEventPayloadFromAdValue → NSNull). Fabric event
    // strings default to ""; bannerEventPayload maps empty/absent → null for PaidEvent.
    std::dynamic_pointer_cast<const facebook::react::RNGoogleMobileAdsBannerViewEventEmitter>(
        strongSelf->_eventEmitter)
        ->onNativeEvent(facebook::react::RNGoogleMobileAdsBannerViewEventEmitter::OnNativeEvent {
          .type = "onPaid", .value = value.value.doubleValue,
          .precision = @(value.precision).doubleValue, .currency = value.currencyCode.UTF8String,
          .responseInfoJson = responseInfoJsonStd,
        });
  };
  _banner.rootViewController = [UIApplication sharedApplication].delegate.window.rootViewController;
  _banner.delegate = self;
}

- (void)requestAd {
#ifndef __LP64__
  return;  // prevent crash on 32bit
#endif

  if (_unitId == nil || _sizeConfig == nil || _request == nil || _manualImpressionsEnabled == nil) {
    [self setRequested:NO];
    return;
  } else {
    [self initBanner:GADAdSizeFromNSValue(_sizeConfig[@"sizes"][0])];
    [self addSubview:_banner];
    _banner.adUnitID = _unitId;
    [self setRequested:YES];
    [self load];
  }
}

- (void)load {
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

- (void)handleCommand:(const NSString *)commandName args:(const NSArray *)args {
  if ([commandName isEqual:@"recordManualImpression"]) {
    [self recordManualImpression];
  } else if ([commandName isEqual:@"load"]) {
    [self load];
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
    NSDictionary *responseInfo =
        [RNGoogleMobileAdsResponseInfo dictionaryFromResponseInfo:bannerView.responseInfo
                                                          compact:NO];
    NSString *responseInfoJson = @"";
    if (responseInfo != nil) {
      NSData *jsonData = [NSJSONSerialization dataWithJSONObject:responseInfo options:0 error:nil];
      if (jsonData != nil) {
        responseInfoJson = [[NSString alloc] initWithData:jsonData encoding:NSUTF8StringEncoding];
      }
    }
    std::dynamic_pointer_cast<const facebook::react::RNGoogleMobileAdsBannerViewEventEmitter>(
        _eventEmitter)
        ->onNativeEvent(facebook::react::RNGoogleMobileAdsBannerViewEventEmitter::OnNativeEvent{
            .type = "onAdLoaded",
            .width = bannerView.bounds.size.width,
            .height = bannerView.bounds.size.height,
            .responseInfoJson = std::string([responseInfoJson UTF8String]),
        });
  }
}

- (void)bannerView:(GADBannerView *)bannerView didFailToReceiveAdWithError:(NSError *)error {
  NSDictionary *errorAndMessage = [RNGoogleMobileAdsCommon adErrorPayloadFromAdError:error
                                                                               phase:@"load"];
  NSDictionary *responseInfo = [RNGoogleMobileAdsResponseInfo
      dictionaryFromResponseInfo:[RNGoogleMobileAdsResponseInfo responseInfoFromLoadError:error]
                         compact:NO];
  NSString *responseInfoJson = @"";
  if (responseInfo != nil) {
    NSData *jsonData = [NSJSONSerialization dataWithJSONObject:responseInfo options:0 error:nil];
    if (jsonData != nil) {
      responseInfoJson = [[NSString alloc] initWithData:jsonData encoding:NSUTF8StringEncoding];
    }
  }
  if (_eventEmitter != nullptr) {
    std::string reason = errorAndMessage[@"reason"] != nil
                             ? std::string([[errorAndMessage valueForKey:@"reason"] UTF8String])
                             : "";
    std::string phase = errorAndMessage[@"phase"] != nil
                            ? std::string([[errorAndMessage valueForKey:@"phase"] UTF8String])
                            : "load";
    std::dynamic_pointer_cast<const facebook::react::RNGoogleMobileAdsBannerViewEventEmitter>(
        _eventEmitter)
        ->onNativeEvent(facebook::react::RNGoogleMobileAdsBannerViewEventEmitter::OnNativeEvent{
            .type = "onAdFailedToLoad",
            .code = std::string([[errorAndMessage valueForKey:@"code"] UTF8String]),
            .message = std::string([[errorAndMessage valueForKey:@"message"] UTF8String]),
            .reason = reason,
            .phase = phase,
            .responseInfoJson = std::string([responseInfoJson UTF8String]),
        });
  }
}

- (void)bannerViewWillPresentScreen:(GADBannerView *)bannerView {
  if (_eventEmitter != nullptr) {
    NSString *type = [RNGoogleMobileAdsBannerEventMapping
        nativeEventTypeForCallback:RNGoogleMobileAdsBannerDelegateCallbackWillPresentScreen];
    std::dynamic_pointer_cast<const facebook::react::RNGoogleMobileAdsBannerViewEventEmitter>(
        _eventEmitter)
        ->onNativeEvent(facebook::react::RNGoogleMobileAdsBannerViewEventEmitter::OnNativeEvent{
            .type = std::string([type UTF8String])});
  }
}

- (void)bannerViewDidRecordImpression:(GADBannerView *)bannerView {
  if (_eventEmitter != nullptr) {
    NSString *type = [RNGoogleMobileAdsBannerEventMapping
        nativeEventTypeForCallback:RNGoogleMobileAdsBannerDelegateCallbackDidRecordImpression];
    std::dynamic_pointer_cast<const facebook::react::RNGoogleMobileAdsBannerViewEventEmitter>(
        _eventEmitter)
        ->onNativeEvent(facebook::react::RNGoogleMobileAdsBannerViewEventEmitter::OnNativeEvent{
            .type = std::string([type UTF8String])});
  }
}

- (void)bannerViewDidRecordClick:(GADBannerView *)bannerView {
  if (_eventEmitter != nullptr) {
    NSString *type = [RNGoogleMobileAdsBannerEventMapping
        nativeEventTypeForCallback:RNGoogleMobileAdsBannerDelegateCallbackDidRecordClick];
    std::dynamic_pointer_cast<const facebook::react::RNGoogleMobileAdsBannerViewEventEmitter>(
        _eventEmitter)
        ->onNativeEvent(facebook::react::RNGoogleMobileAdsBannerViewEventEmitter::OnNativeEvent{
            .type = std::string([type UTF8String])});
  }
}

- (void)bannerViewWillDismissScreen:(GADBannerView *)bannerView {
  // not in use
}

- (void)bannerViewDidDismissScreen:(GADBannerView *)bannerView {
  if (_eventEmitter != nullptr) {
    NSString *type = [RNGoogleMobileAdsBannerEventMapping
        nativeEventTypeForCallback:RNGoogleMobileAdsBannerDelegateCallbackDidDismissScreen];
    std::dynamic_pointer_cast<const facebook::react::RNGoogleMobileAdsBannerViewEventEmitter>(
        _eventEmitter)
        ->onNativeEvent(facebook::react::RNGoogleMobileAdsBannerViewEventEmitter::OnNativeEvent{
            .type = std::string([type UTF8String])});
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
            .data = std::string(info ? [info UTF8String] : "")});
  }
}

@end

#pragma mark - RNGoogleMobileAdsBannerViewCls

Class<RCTComponentViewProtocol> RNGoogleMobileAdsBannerViewCls(void) {
  return RNGoogleMobileAdsBannerView.class;
}

#endif

#endif