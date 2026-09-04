import { nativeAdapterClassName, networkSlug } from '../src';

describe('@react-native-google-mobile-ads/yandex public surface', () => {
  it('exports networkSlug yandex', () => {
    expect(networkSlug).toBe('yandex');
  });

  it('exports documented iOS AdMob custom-event class names and null Android', () => {
    expect(nativeAdapterClassName).toEqual({
      android: null,
      ios: {
        banner: 'YMAAdMobCustomEventBanner',
        interstitial: 'YMAAdMobCustomEventInterstitial',
        rewarded: 'YMAAdMobCustomEventRewarded',
        native: 'YMAAdMobCustomEventNative',
      },
    });
  });

  it('does not invent JS ad APIs on the package surface', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const surface = require('../src') as Record<string, unknown>;
    expect(Object.keys(surface).sort()).toEqual(['nativeAdapterClassName', 'networkSlug']);
  });
});
