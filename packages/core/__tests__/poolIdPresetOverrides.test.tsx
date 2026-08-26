import {
  AdFormat,
  AdPoolPresets,
  BannerAdSize,
  MultiFormatAdPresets,
  TestIds,
  type AdPoolPresetOverrides,
  type DisplayPoolId,
  type FullscreenPoolId,
} from '../src';

/**
 * poolId joint, preset override tightening, nativeOrBanner honesty.
 * Compile-time locks for override omissions and poolId templates live in
 * type-test.ts (`yarn tsc:compile`).
 */
describe('pool id and preset override surface', () => {
  it('returns typed default poolIds from presets without hand-retyping', () => {
    const display = AdPoolPresets.display(TestIds.GAM_NATIVE);
    const fullscreen = AdPoolPresets.fullscreen(AdFormat.INTERSTITIAL, TestIds.INTERSTITIAL);

    const displayId: DisplayPoolId<typeof TestIds.GAM_NATIVE> = display.poolId;
    const fullscreenId: FullscreenPoolId<
      AdFormat.INTERSTITIAL,
      typeof TestIds.INTERSTITIAL
    > = fullscreen.poolId;

    expect(displayId).toBe(`display-${TestIds.GAM_NATIVE}`);
    expect(fullscreenId).toBe(`fullscreen-${AdFormat.INTERSTITIAL}-${TestIds.INTERSTITIAL}`);
    expect(display.formats).toEqual([AdFormat.NATIVE, AdFormat.BANNER]);
    expect(fullscreen.formats).toEqual([AdFormat.INTERSTITIAL]);
    expect(display.bufferSize).toBe(1);
    expect(fullscreen.bufferSize).toBe(1);
  });

  it('honours AdPoolPresetOverrides without undercutting formats or adUnitId', () => {
    const overrides: AdPoolPresetOverrides = {
      bufferSize: 2,
      requestOptions: { keywords: ['games'] },
      poolId: 'custom-fullscreen',
    };
    const config = AdPoolPresets.fullscreen(AdFormat.REWARDED, TestIds.REWARDED, overrides);

    expect(config.poolId).toBe('custom-fullscreen');
    expect(config.bufferSize).toBe(2);
    expect(config.requestOptions?.keywords).toEqual(['games']);
    expect(config.formats).toEqual([AdFormat.REWARDED]);
    expect(config.adUnitId).toBe(TestIds.REWARDED);
  });

  it('builds nativeOrBanner options from banner sizes only', () => {
    const options = MultiFormatAdPresets.nativeOrBanner([
      BannerAdSize.MEDIUM_RECTANGLE,
      BannerAdSize.BANNER,
    ]);

    expect(options.formats).toEqual([AdFormat.NATIVE, AdFormat.BANNER]);
    expect(options.bannerSizes).toEqual([BannerAdSize.MEDIUM_RECTANGLE, BannerAdSize.BANNER]);
    expect(options.requestCount).toBe(1);
    expect(options.adServer).toBe('ad-manager');
  });
});
