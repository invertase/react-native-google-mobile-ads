import RNGoogleMobileAdsModule from './specs/modules/NativeGoogleMobileAdsModule';
import { validateAdRequestConfiguration } from './validateAdRequestConfiguration';
import { SharedEventEmitter } from './internal/SharedEventEmitter';
import { GoogleMobileAdsNativeEventEmitter } from './internal/GoogleMobileAdsNativeEventEmitter';
import { MobileAdsModuleInterface } from './types/MobileAdsModule.interface';
import { RequestConfiguration } from './types/RequestConfiguration';
import { version } from './version';

const NATIVE_MODULE_EVENT_SUBSCRIPTIONS: Record<string, unknown> = {};

const nativeEvents = [
  'google_mobile_ads_app_open_event',
  'google_mobile_ads_interstitial_event',
  'google_mobile_ads_rewarded_event',
  'google_mobile_ads_rewarded_interstitial_event',
  'google_mobile_ads_pool_event',
];

class MobileAdsModule implements MobileAdsModuleInterface {
  constructor() {
    for (let i = 0, len = nativeEvents.length; i < len; i++) {
      this.subscribeToNativeModuleEvent(nativeEvents[i]);
    }
  }

  subscribeToNativeModuleEvent(eventName: string) {
    if (!NATIVE_MODULE_EVENT_SUBSCRIPTIONS[eventName]) {
      GoogleMobileAdsNativeEventEmitter.addListener(eventName, event => {
        SharedEventEmitter.emit(`${eventName}:${event.adUnitId}:${event.requestId}`, event);
      });

      NATIVE_MODULE_EVENT_SUBSCRIPTIONS[eventName] = true;
    }
  }

  initialize() {
    return RNGoogleMobileAdsModule.initialize();
  }

  setRequestConfiguration(requestConfiguration: RequestConfiguration) {
    let config;
    try {
      config = validateAdRequestConfiguration(requestConfiguration);
    } catch (e) {
      if (e instanceof Error) {
        throw new Error(`googleMobileAds.setRequestConfiguration(*) ${e.message}`);
      }
    }

    return RNGoogleMobileAdsModule.setRequestConfiguration(config);
  }

  openAdInspector() {
    return RNGoogleMobileAdsModule.openAdInspector();
  }

  openDebugMenu(adUnit: string) {
    if (!adUnit) throw new Error('googleMobileAds.openDebugMenu expected a non-empty string value');
    RNGoogleMobileAdsModule.openDebugMenu(adUnit);
  }

  setAppVolume(volume: number) {
    if (volume < 0 || volume > 1)
      throw new Error('The app volume must be a value between 0 and 1 inclusive.');
    RNGoogleMobileAdsModule.setAppVolume(volume);
  }

  setAppMuted(muted: boolean) {
    RNGoogleMobileAdsModule.setAppMuted(muted);
  }

  disableMediationAdapterInitialization() {
    // Stub no-op until native wiring: then queued until initialize / reject after.
  }

  disableSdkCrashReporting() {
    // Stub no-op until native wiring (real native: no-op on classic Android).
  }

  setPublisherFirstPartyIdEnabled(enabled: boolean): Promise<void> {
    void enabled;
    // Stub resolves immediately; native wiring later (void on both platforms).
    return Promise.resolve();
  }

  getVersion(): string {
    // Stub: returns the JS package version until native SDK version is wired.
    return version;
  }
}

const MobileAdsInstance = new MobileAdsModule();

export const MobileAds = () => {
  return MobileAdsInstance;
};

export default MobileAds;
