import React from 'react';
import { act, render } from '@testing-library/react-native';

import {
  AdFormat,
  BannerAdSize,
  MultiFormatAdPresets,
  useAdPool,
  useMultiFormatAd,
  usePooledAd,
  type MultiFormatAdRequestOptions,
} from '../src';
import NativeGoogleMobileAdsNativeModule from '../src/specs/modules/NativeGoogleMobileAdsNativeModule';

/**
 * Hook argument freshness and load-coalescing contract locks:
 * - Callback identity is stable across re-renders even when hook args change
 *   or options are inline each render (argument freshness via refs).
 * - poll() and load() coalesce concurrent calls onto one in-flight promise
 *   per hook instance (StrictMode double-invoke safety).
 */

const CALLBACK_IDENTITY =
  'poll/load/release/retry keep the same identity for the life of the hook instance';
const ARGUMENT_FRESHNESS =
  'poolId/adUnitId/options are sampled when the callback runs; inline options do not change load identity';
const LOAD_POLL_COALESCING =
  'poll() and load() coalesce concurrent calls per hook instance (StrictMode-safe)';

describe('hook argument freshness and load coalescing', () => {
  it('locks the documented freshness / coalescing prose', () => {
    expect(CALLBACK_IDENTITY).toContain('same identity');
    expect(ARGUMENT_FRESHNESS).toContain('inline options');
    expect(LOAD_POLL_COALESCING).toContain('StrictMode');
  });

  it('keeps poll/load/release/retry identity stable across re-renders with fresh inline options', () => {
    const snapshots: Array<{
      poll: () => unknown;
      releasePooled: () => unknown;
      load: () => unknown;
      releaseMulti: () => unknown;
      retry: () => void;
    }> = [];

    function Probe({ tick }: { tick: number }) {
      const pooled = usePooledAd(`pool-${tick}`);
      const multi = useMultiFormatAd({
        adUnitId: `unit-${tick}`,
        requestOptions: MultiFormatAdPresets.nativeOrBanner([BannerAdSize.BANNER]),
        autoLoad: false,
      });
      // Also lock a raw inline options object.
      const multiInline = useMultiFormatAd({
        adUnitId: `unit-inline-${tick}`,
        requestOptions: { formats: [AdFormat.NATIVE] },
        autoLoad: false,
      });
      const pool = useAdPool(`pool-${tick}`);

      snapshots.push({
        poll: pooled.poll,
        releasePooled: pooled.release,
        load: multi.load,
        releaseMulti: multi.release,
        retry: pool.retry,
      });
      // Touch the second hook so identity is observable if we expand later.
      void multiInline.load;
      return null;
    }

    const { rerender } = render(<Probe tick={0} />);
    rerender(<Probe tick={1} />);
    rerender(<Probe tick={2} />);

    // StrictMode may double-invoke render (pairs). Take the first of each tick.
    const perTick = snapshots.filter((_, index) => index % 2 === 0).slice(0, 3);
    expect(perTick).toHaveLength(3);
    const [a, b, c] = perTick;
    expect(a!.poll).toBe(b!.poll);
    expect(b!.poll).toBe(c!.poll);
    expect(a!.releasePooled).toBe(c!.releasePooled);
    expect(a!.load).toBe(b!.load);
    expect(b!.load).toBe(c!.load);
    expect(a!.releaseMulti).toBe(c!.releaseMulti);
    expect(a!.retry).toBe(c!.retry);
  });

  it('coalesces concurrent poll() and load() onto one promise per hook instance', async () => {
    let pollFn: (() => Promise<unknown>) | undefined;
    let loadFn: (() => Promise<unknown>) | undefined;

    function Probe() {
      const pooled = usePooledAd('fullscreen-pool');
      const multi = useMultiFormatAd({
        adUnitId: 'unit',
        requestOptions: { formats: [AdFormat.NATIVE] },
        autoLoad: false,
      });
      pollFn = pooled.poll;
      loadFn = multi.load;
      return null;
    }

    render(<Probe />);

    const p1 = pollFn!();
    const p2 = pollFn!();
    expect(p1).toBe(p2);
    await expect(p1).resolves.toEqual({ status: 'empty' });

    await act(async () => {
      const l1 = loadFn!();
      const l2 = loadFn!();
      expect(l1).toBe(l2);
      await expect(l1).resolves.toEqual({
        status: 'no-fill',
        ads: [],
        errors: [],
        responseInfo: null,
      });
    });
  });
});

describe('useMultiFormatAd automatic request-content reloads', () => {
  type NativeResult = Awaited<
    ReturnType<typeof NativeGoogleMobileAdsNativeModule.loadMultiFormat>
  >;

  const noFill = {
    format: 'none' as const,
    responseInfo: null,
    error: null,
  };

  beforeEach(() => {
    jest.mocked(NativeGoogleMobileAdsNativeModule.loadMultiFormat).mockReset();
    jest.mocked(NativeGoogleMobileAdsNativeModule.destroyHandle).mockReset();
    jest.mocked(NativeGoogleMobileAdsNativeModule.loadMultiFormat).mockResolvedValue(noFill);
  });

  async function flushLoad() {
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  function deferredNative() {
    let resolve!: (value: NativeResult) => void;
    const promise = new Promise<NativeResult>(next => {
      resolve = next;
    });
    return { promise, resolve };
  }

  function responseInfo(responseId: string) {
    return {
      responseId,
      adapterClassName: null,
      loadedAdapterResponse: null,
      adapterResponses: [],
      extras: {},
    };
  }

  it.each([
    {
      name: 'formats',
      first: { formats: [AdFormat.NATIVE] },
      second: {
        formats: [AdFormat.BANNER],
        bannerSizes: [BannerAdSize.BANNER],
        adServer: 'ad-manager' as const,
      },
    },
    {
      name: 'banner sizes',
      first: {
        formats: [AdFormat.BANNER],
        bannerSizes: [BannerAdSize.BANNER],
        adServer: 'ad-manager' as const,
      },
      second: {
        formats: [AdFormat.BANNER],
        bannerSizes: [BannerAdSize.LARGE_BANNER],
        adServer: 'ad-manager' as const,
      },
    },
    {
      name: 'keywords',
      first: { formats: [AdFormat.NATIVE], keywords: ['games'] },
      second: { formats: [AdFormat.NATIVE], keywords: ['sports'] },
    },
    {
      name: 'request fields',
      first: {
        formats: [AdFormat.NATIVE],
        contentUrl: 'https://example.com/first',
        requestNonPersonalizedAdsOnly: false,
      },
      second: {
        formats: [AdFormat.NATIVE],
        contentUrl: 'https://example.com/second',
        requestNonPersonalizedAdsOnly: true,
      },
    },
  ] satisfies Array<{
    name: string;
    first: MultiFormatAdRequestOptions;
    second: MultiFormatAdRequestOptions;
  }>)('reloads exactly once when $name change', async ({ first, second }) => {
    function Probe({ requestOptions }: { requestOptions: MultiFormatAdRequestOptions }) {
      useMultiFormatAd({ adUnitId: 'content-key-unit', requestOptions });
      return null;
    }

    const view = render(<Probe requestOptions={first} />);
    await flushLoad();
    expect(NativeGoogleMobileAdsNativeModule.loadMultiFormat).toHaveBeenCalledTimes(1);

    view.rerender(<Probe requestOptions={second} />);
    await flushLoad();
    expect(NativeGoogleMobileAdsNativeModule.loadMultiFormat).toHaveBeenCalledTimes(2);
  });

  it('reloads exactly once when only adUnitId changes', async () => {
    function Probe({ adUnitId }: { adUnitId: string }) {
      useMultiFormatAd({
        adUnitId,
        requestOptions: { formats: [AdFormat.NATIVE] },
      });
      return null;
    }

    const view = render(<Probe adUnitId="/123/first" />);
    await flushLoad();
    view.rerender(<Probe adUnitId="/123/second" />);
    await flushLoad();

    expect(NativeGoogleMobileAdsNativeModule.loadMultiFormat).toHaveBeenCalledTimes(2);
    expect(NativeGoogleMobileAdsNativeModule.loadMultiFormat).toHaveBeenLastCalledWith(
      '/123/second',
      expect.objectContaining({ formats: [AdFormat.NATIVE] }),
    );
  });

  it('treats object key order as equivalent while preserving array order', async () => {
    function Probe({ reverseKeys, reverseKeywords }: { reverseKeys: boolean; reverseKeywords: boolean }) {
      const customTargeting = reverseKeys
        ? { audience: 'reader', section: 'sports' }
        : { section: 'sports', audience: 'reader' };
      useMultiFormatAd({
        adUnitId: '/123/key-order-unit',
        requestOptions: {
          formats: [AdFormat.NATIVE, AdFormat.BANNER],
          bannerSizes: [BannerAdSize.BANNER],
          requestCount: 1,
          adServer: 'ad-manager',
          stalenessWindowMillis: 60_000,
          requestNonPersonalizedAdsOnly: true,
          networkExtras: { campaign: 'launch', collapsible: 'bottom' },
          keywords: reverseKeywords ? ['second', 'first'] : ['first', 'second'],
          contentUrl: 'https://example.com/current',
          neighboringContentUrls: ['https://example.com/neighbor'],
          customTargeting,
          categoryExclusions: ['sensitive'],
          requestAgent: 'test-agent',
          serverSideVerificationOptions: { userId: 'user', customData: 'data' },
          publisherProvidedId: 'publisher-id',
          publisherProvidedSignals: { IAB_CONTENT_2_2: [533] },
        },
      });
      return null;
    }

    const view = render(<Probe reverseKeys={false} reverseKeywords={false} />);
    await flushLoad();
    view.rerender(<Probe reverseKeys reverseKeywords={false} />);
    await flushLoad();
    expect(NativeGoogleMobileAdsNativeModule.loadMultiFormat).toHaveBeenCalledTimes(1);

    view.rerender(<Probe reverseKeys reverseKeywords />);
    await flushLoad();
    expect(NativeGoogleMobileAdsNativeModule.loadMultiFormat).toHaveBeenCalledTimes(2);
  });

  it('issues one automatic load in StrictMode and keeps callback identities stable', async () => {
    const snapshots: Array<ReturnType<typeof useMultiFormatAd>> = [];
    function Probe({ keyword }: { keyword: string }) {
      snapshots.push(
        useMultiFormatAd({
          adUnitId: 'strict-content-unit',
          requestOptions: { formats: [AdFormat.NATIVE], keywords: [keyword] },
        }),
      );
      return null;
    }

    const view = render(
      <React.StrictMode>
        <Probe keyword="first" />
      </React.StrictMode>,
    );
    await flushLoad();
    expect(NativeGoogleMobileAdsNativeModule.loadMultiFormat).toHaveBeenCalledTimes(1);
    expect(snapshots.at(-1)!.status).toBe('no-fill');
    const first = snapshots[0]!;

    view.rerender(
      <React.StrictMode>
        <Probe keyword="second" />
      </React.StrictMode>,
    );
    await flushLoad();
    expect(NativeGoogleMobileAdsNativeModule.loadMultiFormat).toHaveBeenCalledTimes(2);
    const latest = snapshots.at(-1)!;
    expect(latest.status).toBe('no-fill');
    expect(latest.load).toBe(first.load);
    expect(latest.retry).toBe(first.retry);
    expect(latest.release).toBe(first.release);
    expect(NativeGoogleMobileAdsNativeModule.loadMultiFormat).toHaveBeenLastCalledWith(
      'strict-content-unit',
      expect.objectContaining({ keywords: ['second'] }),
    );
  });

  it('counts a matching manually-started flight as the automatic load', async () => {
    function Probe() {
      const multi = useMultiFormatAd({
        adUnitId: 'matching-flight-unit',
        requestOptions: { formats: [AdFormat.NATIVE] },
      });
      React.useLayoutEffect(() => {
        void multi.load();
      }, [multi.load]);
      return null;
    }

    render(<Probe />);
    await flushLoad();
    expect(NativeGoogleMobileAdsNativeModule.loadMultiFormat).toHaveBeenCalledTimes(1);
  });

  it('collapses three in-flight request changes to one load of the latest', async () => {
    const first = deferredNative();
    const second = deferredNative();
    const staleResponse = responseInfo('stale-filled-response');
    jest
      .mocked(NativeGoogleMobileAdsNativeModule.loadMultiFormat)
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    let result: ReturnType<typeof useMultiFormatAd> | undefined;
    function Probe({ keyword }: { keyword: string }) {
      result = useMultiFormatAd({
        adUnitId: 'inflight-content-unit',
        requestOptions: {
          formats: [AdFormat.BANNER],
          bannerSizes: [BannerAdSize.BANNER],
          adServer: 'ad-manager',
          keywords: [keyword],
        },
      });
      return null;
    }

    const view = render(<Probe keyword="old" />);
    const stalePromise = result!.load();
    expect(NativeGoogleMobileAdsNativeModule.loadMultiFormat).toHaveBeenCalledTimes(1);
    view.rerender(<Probe keyword="ignored-1" />);
    view.rerender(<Probe keyword="ignored-2" />);
    view.rerender(<Probe keyword="new" />);
    expect(NativeGoogleMobileAdsNativeModule.loadMultiFormat).toHaveBeenCalledTimes(1);

    await act(async () => {
      first.resolve({
        format: 'banner',
        handleId: 'stale-handle',
        width: 320,
        height: 50,
        responseInfo: staleResponse,
        error: null,
      });
      await expect(stalePromise).resolves.toEqual({
        status: 'no-fill',
        ads: [],
        errors: [],
        responseInfo: staleResponse,
      });
    });
    expect(NativeGoogleMobileAdsNativeModule.destroyHandle).toHaveBeenCalledTimes(1);
    expect(NativeGoogleMobileAdsNativeModule.destroyHandle).toHaveBeenCalledWith('stale-handle');
    expect(NativeGoogleMobileAdsNativeModule.loadMultiFormat).toHaveBeenCalledTimes(2);
    expect(NativeGoogleMobileAdsNativeModule.loadMultiFormat).toHaveBeenLastCalledWith(
      'inflight-content-unit',
      expect.objectContaining({ keywords: ['new'] }),
    );
    expect(result!.status).toBe('loading');

    await act(async () => {
      second.resolve(noFill);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result!.status).toBe('no-fill');
  });

  it('starts the latest signature after autoLoad turns off then on during a flight', async () => {
    const first = deferredNative();
    jest
      .mocked(NativeGoogleMobileAdsNativeModule.loadMultiFormat)
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce(noFill);

    let result: ReturnType<typeof useMultiFormatAd> | undefined;
    function Probe({ keyword, autoLoad }: { keyword: string; autoLoad: boolean }) {
      result = useMultiFormatAd({
        adUnitId: 'toggle-content-unit',
        requestOptions: { formats: [AdFormat.NATIVE], keywords: [keyword] },
        autoLoad,
      });
      return null;
    }

    const view = render(<Probe keyword="old" autoLoad />);
    const oldPromise = result!.load();
    view.rerender(<Probe keyword="new" autoLoad />);
    view.rerender(<Probe keyword="new" autoLoad={false} />);

    await act(async () => {
      first.resolve(noFill);
      await expect(oldPromise).resolves.toEqual({
        status: 'no-fill',
        ads: [],
        errors: [],
        responseInfo: null,
      });
    });
    expect(result!.status).toBe('idle');
    expect(NativeGoogleMobileAdsNativeModule.loadMultiFormat).toHaveBeenCalledTimes(1);

    view.rerender(<Probe keyword="new" autoLoad />);
    await flushLoad();
    expect(NativeGoogleMobileAdsNativeModule.loadMultiFormat).toHaveBeenCalledTimes(2);
    expect(NativeGoogleMobileAdsNativeModule.loadMultiFormat).toHaveBeenLastCalledWith(
      'toggle-content-unit',
      expect.objectContaining({ keywords: ['new'] }),
    );
    expect(result!.status).toBe('no-fill');
  });

  it('retains the current response record when a disabled superseding request abandons a flight', async () => {
    const pending = deferredNative();
    const priorResponse = {
      responseId: 'prior-response',
      adapterClassName: null,
      loadedAdapterResponse: null,
      adapterResponses: [],
      extras: {},
    };
    jest
      .mocked(NativeGoogleMobileAdsNativeModule.loadMultiFormat)
      .mockResolvedValueOnce({ ...noFill, responseInfo: priorResponse })
      .mockReturnValueOnce(pending.promise);

    let result: ReturnType<typeof useMultiFormatAd> | undefined;
    function Probe({ keyword, autoLoad }: { keyword: string; autoLoad: boolean }) {
      result = useMultiFormatAd({
        adUnitId: 'retained-response-unit',
        requestOptions: { formats: [AdFormat.NATIVE], keywords: [keyword] },
        autoLoad,
      });
      return null;
    }

    const view = render(<Probe keyword="old" autoLoad />);
    await flushLoad();
    expect(result!.responseInfo).toEqual(priorResponse);

    let stalePromise!: ReturnType<NonNullable<typeof result>['load']>;
    act(() => {
      stalePromise = result!.load();
    });
    view.rerender(<Probe keyword="new" autoLoad={false} />);
    await act(async () => {
      pending.resolve(noFill);
      await stalePromise;
    });

    expect(result).toMatchObject({
      status: 'idle',
      ads: [],
      errors: [],
      responseInfo: priorResponse,
    });
  });

  it('destroys and never publishes a filled load released while in flight', async () => {
    const pending = deferredNative();
    const releasedResponse = responseInfo('released-response');
    jest
      .mocked(NativeGoogleMobileAdsNativeModule.loadMultiFormat)
      .mockReturnValueOnce(pending.promise);

    let result: ReturnType<typeof useMultiFormatAd> | undefined;
    function Probe() {
      result = useMultiFormatAd({
        adUnitId: 'release-flight-unit',
        requestOptions: {
          formats: [AdFormat.BANNER],
          bannerSizes: [BannerAdSize.BANNER],
          adServer: 'ad-manager',
        },
        autoLoad: false,
      });
      return null;
    }

    render(<Probe />);
    let loadPromise!: ReturnType<NonNullable<typeof result>['load']>;
    act(() => {
      loadPromise = result!.load();
    });
    act(() => {
      expect(result!.release()).toEqual([]);
    });
    await act(async () => {
      pending.resolve({
        format: 'banner',
        handleId: 'released-inflight-handle',
        width: 320,
        height: 50,
        responseInfo: releasedResponse,
        error: null,
      });
      await expect(loadPromise).resolves.toEqual({
        status: 'no-fill',
        ads: [],
        errors: [],
        responseInfo: releasedResponse,
      });
    });

    expect(NativeGoogleMobileAdsNativeModule.destroyHandle).toHaveBeenCalledTimes(1);
    expect(NativeGoogleMobileAdsNativeModule.destroyHandle).toHaveBeenCalledWith(
      'released-inflight-handle',
    );
    expect(result).toMatchObject({ status: 'idle', ads: [], errors: [] });
  });

  it('destroys a superseded partial result after unmount without starting the replacement', async () => {
    const pending = deferredNative();
    const partialResponse = responseInfo('partial-response');
    jest
      .mocked(NativeGoogleMobileAdsNativeModule.loadMultiFormat)
      .mockReturnValueOnce(pending.promise);

    let result: ReturnType<typeof useMultiFormatAd> | undefined;
    function Probe({ keyword }: { keyword: string }) {
      result = useMultiFormatAd({
        adUnitId: 'unmount-superseded-unit',
        requestOptions: {
          formats: [AdFormat.BANNER],
          bannerSizes: [BannerAdSize.BANNER],
          adServer: 'ad-manager',
          keywords: [keyword],
        },
      });
      return null;
    }

    const view = render(<Probe keyword="old" />);
    const stalePromise = result!.load();
    view.rerender(<Probe keyword="new" />);
    view.unmount();
    let staleResult!: Awaited<typeof stalePromise>;
    await act(async () => {
      pending.resolve({
        format: 'banner',
        handleId: 'unmounted-partial-handle',
        width: 320,
        height: 50,
        responseInfo: partialResponse,
        error: {
          code: 'network-error',
          message: 'partial failure',
          reason: 'network-error',
          phase: 'load',
          responseInfo: partialResponse,
        },
      });
      staleResult = await stalePromise;
    });

    expect(staleResult).toMatchObject({
      status: 'error',
      ads: [],
      responseInfo: partialResponse,
    });
    expect(staleResult.errors).toHaveLength(1);
    expect(staleResult.errors[0]).toMatchObject({
      code: 'googleMobileAds/multi-format/network-error',
      message: '[googleMobileAds/multi-format/network-error] partial failure',
      reason: 'network-error',
      phase: 'load',
      responseInfo: partialResponse,
    });
    expect(NativeGoogleMobileAdsNativeModule.destroyHandle).toHaveBeenCalledTimes(1);
    expect(NativeGoogleMobileAdsNativeModule.destroyHandle).toHaveBeenCalledWith(
      'unmounted-partial-handle',
    );
    expect(NativeGoogleMobileAdsNativeModule.loadMultiFormat).toHaveBeenCalledTimes(1);
  });

  it('does not publish an error from a superseded request', async () => {
    const pending = deferredNative();
    const staleResponse = responseInfo('stale-error-response');
    jest
      .mocked(NativeGoogleMobileAdsNativeModule.loadMultiFormat)
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValueOnce(noFill);

    let result: ReturnType<typeof useMultiFormatAd> | undefined;
    function Probe({ keyword }: { keyword: string }) {
      result = useMultiFormatAd({
        adUnitId: 'stale-error-unit',
        requestOptions: { formats: [AdFormat.NATIVE], keywords: [keyword] },
      });
      return null;
    }

    const view = render(<Probe keyword="old" />);
    const stalePromise = result!.load();
    view.rerender(<Probe keyword="new" />);
    let staleResult!: Awaited<typeof stalePromise>;
    await act(async () => {
      pending.resolve({
        format: 'none',
        responseInfo: staleResponse,
        error: {
          code: 'network-error',
          message: 'stale failure',
          reason: 'network-error',
          phase: 'load',
          responseInfo: staleResponse,
        },
      });
      staleResult = await stalePromise;
      await Promise.resolve();
    });

    expect(staleResult).toMatchObject({
      status: 'error',
      ads: [],
      responseInfo: staleResponse,
    });
    expect(staleResult.errors).toHaveLength(1);
    expect(staleResult.errors[0]).toMatchObject({
      code: 'googleMobileAds/multi-format/network-error',
      message: '[googleMobileAds/multi-format/network-error] stale failure',
      reason: 'network-error',
      phase: 'load',
      responseInfo: staleResponse,
    });
    expect(NativeGoogleMobileAdsNativeModule.loadMultiFormat).toHaveBeenCalledTimes(2);
    expect(result!.status).toBe('no-fill');
    expect(result!.errors).toEqual([]);
  });

  it('loads changed contents after release without reclaiming the released handle', async () => {
    jest
      .mocked(NativeGoogleMobileAdsNativeModule.loadMultiFormat)
      .mockResolvedValueOnce({
        format: 'banner',
        handleId: 'released-handle',
        width: 320,
        height: 50,
        responseInfo: null,
        error: null,
      })
      .mockResolvedValueOnce(noFill);

    let result: ReturnType<typeof useMultiFormatAd> | undefined;
    function Probe({ keyword }: { keyword: string }) {
      result = useMultiFormatAd({
        adUnitId: 'released-content-unit',
        requestOptions: {
          formats: [AdFormat.BANNER],
          bannerSizes: [BannerAdSize.BANNER],
          adServer: 'ad-manager',
          keywords: [keyword],
        },
      });
      return null;
    }

    const view = render(<Probe keyword="old" />);
    await flushLoad();
    expect(result!.status).toBe('loaded');
    let released: ReturnType<typeof result.release> = [];
    act(() => {
      released = result!.release();
    });
    expect(released).toHaveLength(1);
    expect(NativeGoogleMobileAdsNativeModule.destroyHandle).not.toHaveBeenCalled();

    view.rerender(<Probe keyword="new" />);
    await flushLoad();
    expect(NativeGoogleMobileAdsNativeModule.loadMultiFormat).toHaveBeenCalledTimes(2);
    expect(result!.status).toBe('no-fill');
    expect(NativeGoogleMobileAdsNativeModule.destroyHandle).not.toHaveBeenCalled();

    released[0]!.destroy();
    expect(NativeGoogleMobileAdsNativeModule.destroyHandle).toHaveBeenCalledWith(
      'released-handle',
    );
  });

  it('loads changed contents after an error result', async () => {
    const currentErrorResponse = responseInfo('current-error-response');
    jest
      .mocked(NativeGoogleMobileAdsNativeModule.loadMultiFormat)
      .mockResolvedValueOnce({
        format: 'none',
        responseInfo: currentErrorResponse,
        error: {
          code: 'network-error',
          message: 'first request failed',
          reason: 'network-error',
          phase: 'load',
          responseInfo: currentErrorResponse,
        },
      })
      .mockResolvedValueOnce(noFill);

    let result: ReturnType<typeof useMultiFormatAd> | undefined;
    function Probe({ keyword }: { keyword: string }) {
      result = useMultiFormatAd({
        adUnitId: 'error-content-unit',
        requestOptions: { formats: [AdFormat.NATIVE], keywords: [keyword] },
      });
      return null;
    }

    const view = render(<Probe keyword="old" />);
    const currentPromise = result!.load();
    let current!: Awaited<typeof currentPromise>;
    await act(async () => {
      current = await currentPromise;
    });
    expect(result!.status).toBe('error');
    expect(current).toEqual({
      status: 'error',
      ads: [],
      errors: result!.errors,
      responseInfo: currentErrorResponse,
    });
    expect(current.errors[0]).toMatchObject({
      code: 'googleMobileAds/multi-format/network-error',
      message: '[googleMobileAds/multi-format/network-error] first request failed',
      reason: 'network-error',
      phase: 'load',
      responseInfo: currentErrorResponse,
    });

    view.rerender(<Probe keyword="new" />);
    await flushLoad();
    expect(NativeGoogleMobileAdsNativeModule.loadMultiFormat).toHaveBeenCalledTimes(2);
    expect(result!.status).toBe('no-fill');
  });

  it('does not react to request changes while autoLoad is false and manual load samples current args', async () => {
    let result: ReturnType<typeof useMultiFormatAd> | undefined;
    function Probe({ keyword }: { keyword: string }) {
      result = useMultiFormatAd({
        adUnitId: 'manual-content-unit',
        requestOptions: { formats: [AdFormat.NATIVE], keywords: [keyword] },
        autoLoad: false,
      });
      return null;
    }

    const view = render(<Probe keyword="old" />);
    view.rerender(<Probe keyword="new" />);
    await flushLoad();
    expect(NativeGoogleMobileAdsNativeModule.loadMultiFormat).not.toHaveBeenCalled();

    await act(async () => {
      await result!.load();
    });
    expect(NativeGoogleMobileAdsNativeModule.loadMultiFormat).toHaveBeenCalledTimes(1);
    expect(NativeGoogleMobileAdsNativeModule.loadMultiFormat).toHaveBeenCalledWith(
      'manual-content-unit',
      expect.objectContaining({ keywords: ['new'] }),
    );
  });
});
