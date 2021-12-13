import { Module } from './internal';
import validateAdRequestConfiguration from './validateAdRequestConfiguration';
import version from './version';

const namespace = 'google_ads';

const nativeModuleName = [
  'RNGoogleAdsModule',
  'RNGoogleAdsInterstitialModule',
  'RNGoogleAdsRewardedModule',
];

class GoogleAdsModule extends Module {
  constructor(...args) {
    super(...args);

    this.emitter.addListener('google_ads_interstitial_event', event => {
      this.emitter.emit(
        `google_ads_interstitial_event:${event.adUnitId}:${event.requestId}`,
        event,
      );
    });

    this.emitter.addListener('google_ads_rewarded_event', event => {
      this.emitter.emit(`google_ads_rewarded_event:${event.adUnitId}:${event.requestId}`, event);
    });
  }

  setRequestConfiguration(requestConfiguration) {
    let config;
    try {
      config = validateAdRequestConfiguration(requestConfiguration);
    } catch (e) {
      throw new Error(`googleAds.setRequestConfiguration(*) ${e.message}`);
    }

    return this.native.setRequestConfiguration(config);
  }
}

const googleMobileAds = new GoogleAdsModule('AppName', {
  version,
  namespace,
  nativeModuleName,
  nativeEvents: ['google_ads_interstitial_event', 'google_ads_rewarded_event'],
});

export default () => {
  return googleMobileAds;
};
