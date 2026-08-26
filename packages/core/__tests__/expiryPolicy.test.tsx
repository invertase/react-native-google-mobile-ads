import React from 'react';
import { act, render } from '@testing-library/react-native';

import {
  AdFormat,
  AdPoolPresets,
  AdStalenessGuidanceMillis,
  getAdCapabilities,
  MultiFormatAdRequest,
  MultiFormatBannerAdView,
  useMultiFormatAd,
  usePooledAd,
} from '../src';

describe('expiry policy surface stubs', () => {
  it('exposes guidance defaults as publisher policy constants, not SDK TTL', () => {
    expect(AdStalenessGuidanceMillis.APP_OPEN).toBe(4 * 60 * 60 * 1000);
    expect(AdStalenessGuidanceMillis.OTHER).toBe(60 * 60 * 1000);
  });

  it('reports maxManagedPoolAds as null and exposes per-format preload + peek gates', () => {
    const caps = getAdCapabilities();
    expect(caps.maxManagedPoolAds).toBeNull();
    expect(caps.fullscreenPreloadFormats[AdFormat.REWARDED_INTERSTITIAL]).toBe('unavailable');
    expect(caps.poolResponseInfoPeek).toBe('unavailable');
  });

  it('builds fullscreen and display pool presets with optional staleness override', () => {
    const fullscreen = AdPoolPresets.fullscreen(AdFormat.INTERSTITIAL, 'unit', {
      bufferSize: 2,
      stalenessWindowMillis: AdStalenessGuidanceMillis.OTHER,
    });
    expect(fullscreen).toMatchObject({
      formats: [AdFormat.INTERSTITIAL],
      adUnitId: 'unit',
      bufferSize: 2,
      stalenessWindowMillis: AdStalenessGuidanceMillis.OTHER,
    });

    const display = AdPoolPresets.display('feed');
    expect(display.formats).toEqual([AdFormat.NATIVE, AdFormat.BANNER]);
    expect(display.bufferSize).toBe(1);
  });

  it('rejects MultiFormatAdRequest.load until native wiring lands', async () => {
    const request = MultiFormatAdRequest.create({
      adUnitId: 'unit',
      requestOptions: { formats: [AdFormat.NATIVE] },
    });
    await expect(request.load()).rejects.toThrow('MultiFormatAdRequest.load is not implemented');
    expect(() => request.destroy()).not.toThrow();
  });

  it('returns idle stub state from pool and multi-format hooks', async () => {
    let pooled: ReturnType<typeof usePooledAd> | undefined;
    let multi: ReturnType<typeof useMultiFormatAd> | undefined;
    function Probe() {
      pooled = usePooledAd('display-pool');
      multi = useMultiFormatAd({
        adUnitId: 'unit',
        requestOptions: { formats: [AdFormat.BANNER] },
        autoLoad: false,
      });
      return null;
    }
    render(<Probe />);
    expect(pooled!.status).toBe('idle');
    expect(pooled!.ad).toBeNull();
    expect(multi!.status).toBe('idle');
    expect(multi!.ads).toEqual([]);
    await expect(pooled!.poll()).resolves.toEqual({ status: 'empty' });
    expect(pooled!.release()).toBeNull();
    await act(async () => {
      await expect(multi!.load()).resolves.toEqual({
        status: 'no-fill',
        ads: [],
        errors: [],
        responseInfo: null,
      });
    });
    expect(multi!.status).toBe('no-fill');
    act(() => {
      expect(multi!.release()).toEqual([]);
    });
  });

  it('renders MultiFormatBannerAdView stub without throwing', () => {
    const handle = {
      format: AdFormat.BANNER as const,
      adId: 'ad-1',
      observedAt: 1,
      provenance: 'pool/emulated-no-sdk-preloader' as const,
      stalenessWindowMillis: AdStalenessGuidanceMillis.OTHER,
      stalenessWindowSource: 'guidance/other' as const,
      isStaleByPolicy: () => false,
      onStaleByPolicy: () => () => undefined,
      responseInfo: null,
      size: { width: 320, height: 50 },
      destroy: () => undefined,
    };
    const { toJSON } = render(<MultiFormatBannerAdView handle={handle} />);
    expect(toJSON()).toBeTruthy();
  });
});
