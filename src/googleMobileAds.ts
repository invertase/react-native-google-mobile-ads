import { Module } from './internal';
import validateAdRequestConfiguration from './validateAdRequestConfiguration';
import { version } from './version';
import { MobileAdsModule } from './types/MobileAdsModule';
import { RequestConfiguration } from './types/RequestConfiguration';

const namespace = 'google_ads';

const nativeModuleName = [
  'RNGoogleAdsModule',
  'RNGoogleAdsInterstitialModule',
  'RNGoogleAdsRewardedModule',
];

type Config = {
  version: string;
  namespace: string;
  nativeModuleName: string[];
  nativeEvents: string[];
};

type Event = {
  adUnitId: string;
  requestId: number;
};

class GoogleAdsModule extends Module implements MobileAdsModule {
  constructor(app: string, config: Config) {
    super(app, config);

    this.emitter.addListener('google_ads_interstitial_event', (event: Event) => {
      this.emitter.emit(
        `google_ads_interstitial_event:${event.adUnitId}:${event.requestId}`,
        event,
      );
    });

    this.emitter.addListener('google_ads_rewarded_event', (event: Event) => {
      this.emitter.emit(`google_ads_rewarded_event:${event.adUnitId}:${event.requestId}`, event);
    });
  }

  initialize() {
    return this.native.initialize();
  }

  setRequestConfiguration(requestConfiguration: RequestConfiguration) {
    let config;
    try {
      config = validateAdRequestConfiguration(requestConfiguration);
    } catch (e) {
      if (e instanceof Error) {
        throw new Error(`googleAds.setRequestConfiguration(*) ${e.message}`);
      }
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
