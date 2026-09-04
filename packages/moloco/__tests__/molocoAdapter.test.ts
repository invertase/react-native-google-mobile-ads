import { nativeAdapterClassName, networkSlug } from '../src';

describe('@react-native-google-mobile-ads/moloco public surface', () => {
  it('exports networkSlug moloco', () => {
    expect(networkSlug).toBe('moloco');
  });

  it('exports documented GAM mediation adapter class names', () => {
    expect(nativeAdapterClassName).toEqual({
      android: 'com.google.ads.mediation.moloco.MolocoMediationAdapter',
      ios: 'GADMediationAdapterMoloco',
    });
  });

  it('does not invent JS ad APIs on the package surface', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const surface = require('../src') as Record<string, unknown>;
    expect(Object.keys(surface).sort()).toEqual(['nativeAdapterClassName', 'networkSlug']);
  });
});
