import { Platform } from 'react-native';

import { AdFormat, AdPools, AdPoolPresets, BannerAdSize, getAdCapabilities } from '../src';
import { destroyAllAdPools } from '../src/internal/adPoolRegistry';
import {
  createPoolAdError,
  DOCUMENTED_APP_WIDE_POOL_CAP,
  GOOGLE_DEFAULT_POOL_BUFFER_SIZE,
  validateAdPoolConfig,
} from '../src/validateAdPoolConfig';

describe('FEAT-05 classic fullscreen AdPools', () => {
  afterEach(() => {
    destroyAllAdPools();
  });

  it('reports live classic capabilities with maxManagedPoolAds null and cap honesty 6', () => {
    const caps = getAdCapabilities();
    expect(caps.maxManagedPoolAds).toBeNull();
    expect(DOCUMENTED_APP_WIDE_POOL_CAP).toBe(6);
    expect(caps.fullscreenPreload).toBe('experimental');
    expect(caps.displayPreload).toBe('emulated');
    if (Platform.OS === 'ios') {
      expect(caps.backend).toBe('ios');
      expect(caps.poolResponseInfoPeek).toBe('supported');
      expect(caps.fullscreenPreloadFormats[AdFormat.REWARDED_INTERSTITIAL]).toBe('experimental');
    } else {
      expect(caps.backend).toBe('android-classic');
      expect(caps.poolResponseInfoPeek).toBe('unavailable');
      expect(caps.fullscreenPreloadFormats[AdFormat.REWARDED_INTERSTITIAL]).toBe('unavailable');
    }
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
    if (Platform.OS === 'ios') {
      expect(
        validateAdPoolConfig(
          AdPoolPresets.fullscreen(AdFormat.REWARDED_INTERSTITIAL, 'unit'),
        ).formats,
      ).toEqual([AdFormat.REWARDED_INTERSTITIAL]);
      return;
    }
    expect(() =>
      validateAdPoolConfig(AdPoolPresets.fullscreen(AdFormat.REWARDED_INTERSTITIAL, 'unit')),
    ).toThrow(/pool\/format-preload-unsupported/);
  });

  it('creates, polls, and peeks according to platform capabilities', async () => {
    const config = AdPoolPresets.fullscreen(AdFormat.INTERSTITIAL, 'unit', {
      bufferSize: 2,
    });
    const pool = await AdPools.create(config);
    expect(pool.poolId).toBe(config.poolId);
    expect(pool.resolved.effectiveBufferSize).toBe(2);
    expect(AdPools.get(config.poolId)).toBe(pool);

    const availability = await pool.getAvailability();
    expect(availability.observedCount).toBeGreaterThanOrEqual(0);

    if (Platform.OS === 'ios') {
      await expect(pool.peekResponseInfo()).resolves.toBeNull();
    } else {
      await expect(pool.peekResponseInfo()).rejects.toMatchObject({
        reason: 'pool/peek-unsupported',
      });
    }

    const poll = await pool.poll();
    expect(['filled', 'empty']).toContain(poll.status);
    if (poll.status === 'filled') {
      expect(poll.ad.provenance).toBe('pool/sdk-managed-preloader');
      expect(poll.ad.format).toBe(AdFormat.INTERSTITIAL);
      expect(typeof poll.ad.isStaleByPolicy).toBe('function');
      poll.ad.destroy();
    }

    pool.destroy();
    expect(AdPools.get(config.poolId)).toBeNull();
  });

  it('createPoolAdError carries structured reason', () => {
    const error = createPoolAdError('pool/peek-unsupported', 'no peek');
    expect(error.reason).toBe('pool/peek-unsupported');
    expect(error.phase).toBe('load');
  });
});
