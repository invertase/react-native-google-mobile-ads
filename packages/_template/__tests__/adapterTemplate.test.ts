import { nativeAdapterClassName, networkSlug } from '../src';

describe('A-0 GAM adapter template public surface', () => {
  it('exports networkSlug placeholder for copy-replace', () => {
    expect(networkSlug).toBe('__NETWORK__');
  });

  it('exports nativeAdapterClassName placeholders (API design §5.3)', () => {
    expect(nativeAdapterClassName).toEqual({
      android: '__ANDROID_ADAPTER_CLASS__',
      ios: '__IOS_ADAPTER_CLASS__',
    });
  });

  it('does not invent JS ad APIs on the template surface', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const surface = require('../src') as Record<string, unknown>;
    expect(Object.keys(surface).sort()).toEqual(['nativeAdapterClassName', 'networkSlug']);
  });
});
