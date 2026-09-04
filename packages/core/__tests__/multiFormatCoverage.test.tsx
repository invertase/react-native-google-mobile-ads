import React from 'react';
import { act, render } from '@testing-library/react-native';

import {
  AdFormat,
  BannerAdSize,
  MultiFormatAdRequest,
  MultiFormatBannerAdView,
  useMultiFormatAd,
} from '../src';
import NativeGoogleMobileAdsNativeModule from '../src/specs/modules/NativeGoogleMobileAdsNativeModule';
import type { AdError } from '../src/types/AdError';
import { NativeError } from '../src/internal/NativeError';

function nativeWinner(overrides: Record<string, unknown> = {}) {
  return {
    format: 'native' as const,
    handleId: 'h-native',
    responseId: 'r-native',
    advertiser: null,
    body: 'b',
    callToAction: 'c',
    headline: 'h',
    price: null,
    store: null,
    starRating: null,
    icon: null,
    images: null,
    mediaContent: { aspectRatio: 1, hasVideoContent: false, duration: 0 },
    extras: null,
    responseInfo: { responseId: 'r-native' },
    error: null,
    ...overrides,
  };
}

describe('FEAT-04 multi-format coverage', () => {
  beforeEach(() => {
    jest.mocked(NativeGoogleMobileAdsNativeModule.loadMultiFormat).mockReset();
    jest.mocked(NativeGoogleMobileAdsNativeModule.destroyHandle).mockReset();
    jest.mocked(NativeGoogleMobileAdsNativeModule.destroy).mockReset();
    jest.mocked(NativeGoogleMobileAdsNativeModule.loadMultiFormat).mockResolvedValue({
      format: 'none',
      responseInfo: null,
      error: null,
    });
  });

  it('validates custom WxH and object sizes; rejects bad shapes', () => {
    expect(() =>
      MultiFormatAdRequest.create({
        adUnitId: '/123/u',
        requestOptions: {
          formats: [AdFormat.BANNER],
          bannerSizes: ['320x50', { width: 300, height: 250 }],
          adServer: 'ad-manager',
        },
      }),
    ).not.toThrow();

    expect(() =>
      MultiFormatAdRequest.create({
        adUnitId: '/123/u',
        requestOptions: {
          formats: [AdFormat.BANNER],
          bannerSizes: [{ width: -1, height: 50 } as never],
          adServer: 'ad-manager',
        },
      }),
    ).toThrow(/width, height/);

    expect(() =>
      MultiFormatAdRequest.create({
        adUnitId: '/123/u',
        requestOptions: {
          formats: [AdFormat.BANNER],
          bannerSizes: [42 as never],
          adServer: 'ad-manager',
        },
      }),
    ).toThrow(/fixed GAM size/);

    expect(() =>
      MultiFormatAdRequest.create({
        adUnitId: '/123/u',
        requestOptions: {
          formats: [AdFormat.BANNER],
          bannerSizes: ['HUGE' as never],
          adServer: 'ad-manager',
        },
      }),
    ).toThrow(/fixed GAM size/);

    expect(() =>
      MultiFormatAdRequest.create({
        // @ts-expect-error intentional
        adUnitId: 1,
        requestOptions: { formats: [AdFormat.NATIVE] },
      }),
    ).toThrow(/adUnitId/);

    expect(() =>
      MultiFormatAdRequest.create({
        adUnitId: '/123/u',
        // @ts-expect-error intentional
        requestOptions: null,
      }),
    ).toThrow(/requestOptions/);

    expect(() =>
      MultiFormatAdRequest.create({
        adUnitId: '/123/u',
        requestOptions: { formats: ['interstitial' as never] },
      }),
    ).toThrow(/native/);

    expect(() =>
      MultiFormatAdRequest.create({
        adUnitId: '/123/u',
        requestOptions: { formats: [AdFormat.NATIVE, AdFormat.NATIVE] },
      }),
    ).toThrow(/duplicates/);

    expect(() =>
      MultiFormatAdRequest.create({
        adUnitId: '/123/u',
        requestOptions: {
          formats: [AdFormat.NATIVE],
          bannerSizes: 'BANNER' as never,
        },
      }),
    ).toThrow(/bannerSizes.*array/);

    expect(() =>
      MultiFormatAdRequest.create({
        adUnitId: '/123/u',
        requestOptions: {
          formats: [AdFormat.NATIVE],
          adServer: 'admob' as 'ad-manager',
        },
      }),
    ).toThrow(/ad-manager/);

    expect(() =>
      MultiFormatAdRequest.create({
        adUnitId: '/123/u',
        requestOptions: {
          formats: [AdFormat.NATIVE],
          stalenessWindowMillis: -5,
        },
      }),
    ).toThrow(/stalenessWindowMillis/);
  });

  it('maps native reject no-fill and non-no-fill; destroyed load throws', async () => {
    jest.mocked(NativeGoogleMobileAdsNativeModule.loadMultiFormat).mockRejectedValueOnce({
      code: 'no-fill',
      message: 'empty',
      userInfo: { code: 'no-fill', message: 'empty', reason: 'no-fill' },
    });
    const ok = MultiFormatAdRequest.create({
      adUnitId: '/123/u',
      requestOptions: { formats: [AdFormat.NATIVE] },
    });
    await expect(ok.load()).resolves.toEqual({
      ads: [],
      errors: [],
      responseInfo: null,
    });

    jest.mocked(NativeGoogleMobileAdsNativeModule.loadMultiFormat).mockRejectedValueOnce({
      code: 'googleMobileAds/network-error',
      message: 'down',
      userInfo: {
        code: 'network-error',
        message: 'down',
        reason: 'network-error',
        responseInfo: { responseId: 'r-err' },
      },
    });
    const errReq = MultiFormatAdRequest.create({
      adUnitId: '/123/u',
      requestOptions: { formats: [AdFormat.NATIVE] },
    });
    const failed = await errReq.load();
    expect(failed.ads).toEqual([]);
    expect(failed.errors[0]?.reason).toBe('network-error');
    expect(failed.responseInfo).toEqual({ responseId: 'r-err' });

    const destroyed = MultiFormatAdRequest.create({
      adUnitId: '/123/u',
      requestOptions: { formats: [AdFormat.NATIVE] },
    });
    destroyed.destroy();
    await expect(destroyed.load()).rejects.toThrow(/destroyed/);
  });

  it('request.destroy destroys owned banner handles; native destroy is idempotent', async () => {
    jest
      .mocked(NativeGoogleMobileAdsNativeModule.loadMultiFormat)
      .mockResolvedValueOnce(nativeWinner({ format: 'banner', handleId: 'hb', width: 320, height: 50 }));
    const request = MultiFormatAdRequest.create({
      adUnitId: '/123/u',
      requestOptions: {
        formats: [AdFormat.BANNER],
        bannerSizes: [BannerAdSize.BANNER],
        adServer: 'ad-manager',
      },
    });
    const { ads } = await request.load();
    request.destroy();
    expect(NativeGoogleMobileAdsNativeModule.destroyHandle).toHaveBeenCalledWith('hb');
    // Second destroy on handle is a no-op after request claimed it.
    ads[0].destroy();
  });

  it('native handle.destroy is idempotent and clears expiry', async () => {
    jest.mocked(NativeGoogleMobileAdsNativeModule.loadMultiFormat).mockResolvedValueOnce(
      nativeWinner({ handleId: 'hn', responseId: 'rn' }),
    );
    const request = MultiFormatAdRequest.create({
      adUnitId: '/123/u',
      requestOptions: { formats: [AdFormat.NATIVE] },
    });
    const { ads } = await request.load();
    ads[0].destroy();
    ads[0].destroy();
    expect(NativeGoogleMobileAdsNativeModule.destroy).toHaveBeenCalled();
  });

  it('maps format none without error and with non-no-fill error', async () => {
    jest.mocked(NativeGoogleMobileAdsNativeModule.loadMultiFormat).mockResolvedValueOnce({
      format: 'none',
      handleId: undefined,
      responseInfo: null,
      error: null,
    });
    const a = MultiFormatAdRequest.create({
      adUnitId: '/123/u',
      requestOptions: { formats: [AdFormat.NATIVE] },
    });
    await expect(a.load()).resolves.toMatchObject({ ads: [], errors: [] });

    jest.mocked(NativeGoogleMobileAdsNativeModule.loadMultiFormat).mockResolvedValueOnce({
      format: 'none',
      responseInfo: null,
      error: {
        code: 'internal-error',
        message: 'boom',
        reason: 'internal-error',
        phase: 'load',
      },
    });
    const b = MultiFormatAdRequest.create({
      adUnitId: '/123/u',
      requestOptions: { formats: [AdFormat.NATIVE] },
    });
    const result = await b.load();
    expect(result.errors[0]?.reason).toBe('internal-error');
  });

  it('hook load returns error for invalid config and loaded for native fill', async () => {
    let multi: ReturnType<typeof useMultiFormatAd> | undefined;
    function Bad() {
      multi = useMultiFormatAd({
        adUnitId: '/123/u',
        requestOptions: { formats: [AdFormat.BANNER] },
        autoLoad: false,
      });
      return null;
    }
    render(<Bad />);
    await act(async () => {
      const result = await multi!.load();
      expect(result.status).toBe('error');
      expect(result.errors[0]?.reason).toBe('invalid-request');
    });

    jest.mocked(NativeGoogleMobileAdsNativeModule.loadMultiFormat).mockResolvedValueOnce(nativeWinner());
    function Good() {
      multi = useMultiFormatAd({
        adUnitId: '/123/u',
        requestOptions: { formats: [AdFormat.NATIVE] },
        autoLoad: false,
      });
      return null;
    }
    const { unmount } = render(<Good />);
    await act(async () => {
      const result = await multi!.load();
      expect(result.status).toBe('loaded');
      expect(result.ads).toHaveLength(1);
    });
    act(() => {
      const released = multi!.release();
      expect(released).toHaveLength(1);
      released[0].destroy();
    });
    unmount();
  });

  it('hook maps loaded-partial and fires stale-by-policy', async () => {
    const partialError = NativeError.fromEvent(
      { code: 'internal-error', message: 'side' },
      'googleMobileAds/multi-format',
    ) as AdError;
    partialError.reason = 'internal-error';
    partialError.phase = 'load';

    jest.mocked(NativeGoogleMobileAdsNativeModule.loadMultiFormat).mockResolvedValueOnce({
      ...nativeWinner({ handleId: 'stale-1' }),
      error: {
        code: 'internal-error',
        message: 'side',
        reason: 'internal-error',
        phase: 'load',
      },
    });

    let multi: ReturnType<typeof useMultiFormatAd> | undefined;
    function Probe() {
      multi = useMultiFormatAd({
        adUnitId: '/123/u',
        requestOptions: { formats: [AdFormat.NATIVE], stalenessWindowMillis: 1 },
        autoLoad: false,
      });
      return null;
    }
    render(<Probe />);
    await act(async () => {
      const result = await multi!.load();
      expect(result.status).toBe('loaded-partial');
    });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 5));
    });
    expect(multi!.status).toBe('stale-by-policy');
  });

  it('hook destroys ads when unmounted mid-flight', async () => {
    let resolveLoad: (value: unknown) => void = () => undefined;
    jest.mocked(NativeGoogleMobileAdsNativeModule.loadMultiFormat).mockImplementationOnce(
      () =>
        new Promise(resolve => {
          resolveLoad = resolve;
        }),
    );

    let multi: ReturnType<typeof useMultiFormatAd> | undefined;
    function Probe() {
      multi = useMultiFormatAd({
        adUnitId: '/123/u',
        requestOptions: { formats: [AdFormat.NATIVE] },
        autoLoad: false,
      });
      return null;
    }
    const { unmount } = render(<Probe />);
    let pending: Promise<unknown> | undefined;
    act(() => {
      pending = multi!.load();
    });
    unmount();
    await act(async () => {
      resolveLoad(nativeWinner({ handleId: 'late' }));
      await pending;
    });
    expect(NativeGoogleMobileAdsNativeModule.destroy).toHaveBeenCalled();
  });

  it('clearHeldAds destroy path and unmount cleanup cover remaining branches', async () => {
    jest.mocked(NativeGoogleMobileAdsNativeModule.loadMultiFormat).mockResolvedValue(nativeWinner());
    let multi: ReturnType<typeof useMultiFormatAd> | undefined;
    function Probe() {
      multi = useMultiFormatAd({
        adUnitId: '/123/u',
        requestOptions: { formats: [AdFormat.NATIVE] },
        autoLoad: false,
      });
      return null;
    }
    const { unmount } = render(<Probe />);
    await act(async () => {
      await multi!.load();
    });
    // Superseding load destroys prior ads via clearHeldAds(true).
    await act(async () => {
      await multi!.load();
    });
    expect(multi!.status).toBe('loaded');
    // Unmount destroys current ads (clearHeldAds path on cleanup).
    unmount();
    expect(NativeGoogleMobileAdsNativeModule.destroy).toHaveBeenCalled();
  });

  it('covers remaining create/load edge arms', async () => {
    expect(() => MultiFormatAdRequest.create([] as never)).toThrow(/config/);
    expect(() =>
      MultiFormatAdRequest.create({
        adUnitId: '',
        requestOptions: { formats: [AdFormat.NATIVE] },
      }),
    ).toThrow(/adUnitId/);

    jest.mocked(NativeGoogleMobileAdsNativeModule.loadMultiFormat).mockResolvedValueOnce({
      format: 'banner',
      handleId: 'hb2',
      width: undefined,
      height: undefined,
      responseInfo: null,
      error: {
        code: 'internal-error',
        message: 'side',
        reason: 'internal-error',
        phase: 'load',
      },
    });
    const bannerReq = MultiFormatAdRequest.create({
      adUnitId: '/123/u',
      requestOptions: {
        formats: [AdFormat.BANNER],
        bannerSizes: [BannerAdSize.BANNER],
        adServer: 'ad-manager',
        stalenessWindowMillis: 60_000,
      },
    });
    const { ads, errors } = await bannerReq.load();
    expect(errors).toHaveLength(1);
    expect(ads[0].isStaleByPolicy()).toBe(false);
    const unsub = ads[0].onStaleByPolicy(() => undefined);
    unsub();
    ads[0].destroy();

    jest.mocked(NativeGoogleMobileAdsNativeModule.loadMultiFormat).mockResolvedValueOnce(
      nativeWinner({ handleId: 'h-diff', responseId: 'r-diff' }),
    );
    const nativeReq = MultiFormatAdRequest.create({
      adUnitId: '/123/u',
      requestOptions: { formats: [AdFormat.NATIVE] },
    });
    const nativeAds = (await nativeReq.load()).ads;
    nativeAds[0].destroy();
    expect(NativeGoogleMobileAdsNativeModule.destroyHandle).toHaveBeenCalledWith('h-diff');

    const req = MultiFormatAdRequest.create({
      adUnitId: '/123/u',
      requestOptions: { formats: [AdFormat.NATIVE] },
    });
    req.destroy();
    req.destroy();
  });

  it('stale callback after unmount is a no-op', async () => {
    jest.mocked(NativeGoogleMobileAdsNativeModule.loadMultiFormat).mockResolvedValueOnce(
      nativeWinner({ handleId: 'stale-unmount' }),
    );
    let multi: ReturnType<typeof useMultiFormatAd> | undefined;
    function Probe() {
      multi = useMultiFormatAd({
        adUnitId: '/123/u',
        requestOptions: { formats: [AdFormat.NATIVE], stalenessWindowMillis: 1 },
        autoLoad: false,
      });
      return null;
    }
    const { unmount } = render(<Probe />);
    await act(async () => {
      await multi!.load();
    });
    unmount();
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 5));
    });
  });

  it('strips namespaced reject codes on load failure', async () => {
    jest.mocked(NativeGoogleMobileAdsNativeModule.loadMultiFormat).mockRejectedValueOnce({
      code: 'googleMobileAds/timeout',
      message: 'slow',
      userInfo: undefined,
    });
    const req = MultiFormatAdRequest.create({
      adUnitId: '/123/u',
      requestOptions: { formats: [AdFormat.NATIVE] },
    });
    const result = await req.load();
    expect(result.errors[0]?.reason).toBe('timeout');
  });

  it('renders MultiFormatBannerAdView with handle size style', () => {
    const handle = {
      format: AdFormat.BANNER as const,
      adId: 'ad-banner',
      observedAt: 1,
      provenance: 'pool/emulated-no-sdk-preloader' as const,
      stalenessWindowMillis: 1000,
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
