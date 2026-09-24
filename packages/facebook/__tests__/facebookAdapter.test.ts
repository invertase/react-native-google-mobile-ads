import { NativeModules } from 'react-native';

const mockSetAdvertiserTrackingEnabled = jest.fn();
const mockSetDataProcessingOptions = jest.fn();
const mockSetDataProcessingOptionsWithLocation = jest.fn();

describe('@react-native-google-mobile-ads/facebook public surface', () => {
  let networkSlug: string;
  let nativeAdapterClassName: { android: string; ios: string };
  let setAdvertiserTrackingEnabled: (enabled: boolean) => void;
  let setDataProcessingOptions: (
    options: string[],
    country?: number,
    state?: number,
  ) => void;

  beforeAll(() => {
    NativeModules.RNGoogleMobileAdsAdapterFacebook = {
      setAdvertiserTrackingEnabled: mockSetAdvertiserTrackingEnabled,
      setDataProcessingOptions: mockSetDataProcessingOptions,
      setDataProcessingOptionsWithLocation: mockSetDataProcessingOptionsWithLocation,
    };

    // Require after NativeModules is stubbed — ESM imports are hoisted above setup.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const surface = require('../src') as typeof import('../src');
    networkSlug = surface.networkSlug;
    nativeAdapterClassName = surface.nativeAdapterClassName;
    setAdvertiserTrackingEnabled = surface.setAdvertiserTrackingEnabled;
    setDataProcessingOptions = surface.setDataProcessingOptions;
  });

  beforeEach(() => {
    mockSetAdvertiserTrackingEnabled.mockClear();
    mockSetDataProcessingOptions.mockClear();
    mockSetDataProcessingOptionsWithLocation.mockClear();
  });

  it('exports networkSlug facebook', () => {
    expect(networkSlug).toBe('facebook');
  });

  it('exports documented GAM mediation adapter class names', () => {
    expect(nativeAdapterClassName).toEqual({
      android: 'com.google.ads.mediation.facebook.FacebookMediationAdapter',
      ios: 'GADMediationAdapterFacebook',
    });
  });

  it('exports Meta privacy hooks alongside adapter constants', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const surface = require('../src') as Record<string, unknown>;
    expect(Object.keys(surface).sort()).toEqual([
      'nativeAdapterClassName',
      'networkSlug',
      'setAdvertiserTrackingEnabled',
      'setDataProcessingOptions',
    ]);
  });

  it('forwards setAdvertiserTrackingEnabled to the native module', () => {
    setAdvertiserTrackingEnabled(true);
    expect(mockSetAdvertiserTrackingEnabled).toHaveBeenCalledWith(true);
  });

  it('rejects non-boolean advertiser tracking values', () => {
    expect(() => setAdvertiserTrackingEnabled('yes' as unknown as boolean)).toThrow(
      /expected a boolean/,
    );
    expect(mockSetAdvertiserTrackingEnabled).not.toHaveBeenCalled();
  });

  it('forwards setDataProcessingOptions without location', () => {
    setDataProcessingOptions(['LDU']);
    expect(mockSetDataProcessingOptions).toHaveBeenCalledWith(['LDU']);
    expect(mockSetDataProcessingOptionsWithLocation).not.toHaveBeenCalled();
  });

  it('forwards setDataProcessingOptions with country and state', () => {
    setDataProcessingOptions(['LDU'], 1, 1000);
    expect(mockSetDataProcessingOptionsWithLocation).toHaveBeenCalledWith(['LDU'], 1, 1000);
    expect(mockSetDataProcessingOptions).not.toHaveBeenCalled();
  });

  it('rejects mismatched country/state arity', () => {
    expect(() => setDataProcessingOptions(['LDU'], 1)).toThrow(/both be provided/);
    expect(mockSetDataProcessingOptions).not.toHaveBeenCalled();
  });
});
