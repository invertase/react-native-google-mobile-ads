import { AdFormat, AdPools, AdPoolPresets, BannerAdSize, getAdCapabilities } from '../src';
import type { AdBackend } from '../src';
import NativeGoogleMobileAdsModule from '../src/specs/modules/NativeGoogleMobileAdsModule';
import { destroyAllAdPools } from '../src/internal/adPoolRegistry';
import {
  createPoolAdError,
  DOCUMENTED_APP_WIDE_POOL_CAP,
  GOOGLE_DEFAULT_POOL_BUFFER_SIZE,
  validateAdPoolConfig,
} from '../src/validateAdPoolConfig';

function mockBackend(backend: AdBackend) {
  jest.mocked(NativeGoogleMobileAdsModule.getConstants).mockReturnValue({
    sdkVersion: 'test-linked-sdk',
    backend,
  });
}

describe('FEAT-05 classic fullscreen AdPools', () => {
  afterEach(() => {
    destroyAllAdPools();
    mockBackend('ios');
  });

  it('reports live classic capabilities with maxManagedPoolAds null and cap honesty 6', () => {
    mockBackend('ios');
    const iosCaps = getAdCapabilities();
    expect(iosCaps.maxManagedPoolAds).toBeNull();
    expect(DOCUMENTED_APP_WIDE_POOL_CAP).toBe(6);
    expect(iosCaps.fullscreenPreload).toBe('experimental');
    expect(iosCaps.displayPreload).toBe('emulated');
    expect(iosCaps.backend).toBe('ios');
    expect(iosCaps.poolResponseInfoPeek).toBe('supported');
    expect(iosCaps.fullscreenPreloadFormats[AdFormat.REWARDED_INTERSTITIAL]).toBe('experimental');

    mockBackend('android-classic');
    const androidCaps = getAdCapabilities();
    expect(androidCaps.backend).toBe('android-classic');
    expect(androidCaps.poolResponseInfoPeek).toBe('unavailable');
    expect(androidCaps.fullscreenPreloadFormats[AdFormat.REWARDED_INTERSTITIAL]).toBe(
      'unavailable',
    );
  });

  it('validates fullscreen presets and defaults omitted bufferSize to Google default 2', () => {
    const resolved = validateAdPoolConfig(
      AdPoolPresets.fullscreen(AdFormat.INTERSTITIAL, 'ca-app-pub-test/unit'),
    );
    expect(resolved.effectiveBufferSize).toBe(1);
    expect(GOOGLE_DEFAULT_POOL_BUFFER_SIZE).toBe(2);

    const handWritten = validateAdPoolConfig({
      poolId: 'hand',
      formats: [AdFormat.REWARDED],
      adUnitId: 'unit',
    });
    expect(handWritten.effectiveBufferSize).toBe(2);
    expect(handWritten.effectiveStalenessWindowSource).toBe('guidance/other');
  });

  it('loud-degrades display pools and hard-errors mixed formats', () => {
    const display = validateAdPoolConfig(
      AdPoolPresets.display('/123/feed', { bannerSizes: [BannerAdSize.BANNER] }),
    );
    expect(display.degraded).toBe(true);
    expect(display.degradeReasons).toContain('pool/emulated-no-sdk-preloader');
    expect(() =>
      validateAdPoolConfig({
        poolId: 'mix',
        formats: [AdFormat.INTERSTITIAL, AdFormat.BANNER],
        adUnitId: 'unit',
      }),
    ).toThrow(/mix/);
  });

  it('hard-errors Android rewarded interstitial when unavailable', () => {
    mockBackend('ios');
    expect(
      validateAdPoolConfig(AdPoolPresets.fullscreen(AdFormat.REWARDED_INTERSTITIAL, 'unit'))
        .formats,
    ).toEqual([AdFormat.REWARDED_INTERSTITIAL]);

    mockBackend('android-classic');
    expect(() =>
      validateAdPoolConfig(AdPoolPresets.fullscreen(AdFormat.REWARDED_INTERSTITIAL, 'unit')),
    ).toThrow(/pool\/format-preload-unsupported/);
  });

  it('creates, polls, and peeks according to backend capabilities', async () => {
    mockBackend('ios');
    const config = AdPoolPresets.fullscreen(AdFormat.INTERSTITIAL, 'unit', {
      bufferSize: 2,
    });
    const iosPool = await AdPools.create(config);
    expect(iosPool.poolId).toBe(config.poolId);
    expect(iosPool.resolved.effectiveBufferSize).toBe(2);
    expect(AdPools.get(config.poolId)).toBe(iosPool);

    const availability = await iosPool.getAvailability();
    expect(availability.observedCount).toBeGreaterThanOrEqual(0);
    await expect(iosPool.peekResponseInfo()).resolves.toBeNull();

    const poll = await iosPool.poll();
    expect(['filled', 'empty']).toContain(poll.status);
    if (poll.status === 'filled') {
      expect(poll.ad.provenance).toBe('pool/sdk-managed-preloader');
      expect(poll.ad.format).toBe(AdFormat.INTERSTITIAL);
      expect(typeof poll.ad.isStaleByPolicy).toBe('function');
      poll.ad.destroy();
    }
    iosPool.destroy();
    expect(AdPools.get(config.poolId)).toBeNull();

    mockBackend('android-classic');
    const androidPool = await AdPools.create(config);
    await expect(androidPool.peekResponseInfo()).rejects.toMatchObject({
      reason: 'pool/peek-unsupported',
    });
    androidPool.destroy();
  });

  it('createPoolAdError carries structured reason', () => {
    const error = createPoolAdError('pool/peek-unsupported', 'no peek');
    expect(error.reason).toBe('pool/peek-unsupported');
    expect(error.phase).toBe('load');
  });
});
