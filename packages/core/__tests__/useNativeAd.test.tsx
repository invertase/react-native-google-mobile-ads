import React from 'react';
import { act, render } from '@testing-library/react-native';

import { NativeAd, TestIds, useNativeAd, type UseNativeAdResult } from '../src';
import type { AdError } from '../src/types/AdError';
import { NativeError } from '../src/internal/NativeError';

function createDeferredNativeAd() {
  let resolve!: (ad: NativeAd) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<NativeAd>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function createFakeNativeAd(adUnitId: string): NativeAd {
  const destroy = jest.fn();
  return {
    adUnitId,
    responseId: `response-${adUnitId}`,
    responseInfo: null,
    destroy,
  } as unknown as NativeAd;
}

function createAdError(
  reason: 'no-fill' | 'mediation-no-fill' | 'network-error',
  phase: 'load' | 'show' = 'load',
): AdError {
  const error = NativeError.fromEvent(
    { code: reason, message: reason },
    'googleMobileAds',
  ) as AdError;
  error.reason = reason;
  error.phase = phase;
  return error;
}

describe('useNativeAd', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('auto-loads and publishes a loaded NativeAd', async () => {
    const fake = createFakeNativeAd(TestIds.NATIVE);
    jest.spyOn(NativeAd, 'createForAdRequest').mockResolvedValue(fake);
    let result: UseNativeAdResult | undefined;

    function Probe() {
      result = useNativeAd({
        adUnitId: TestIds.NATIVE,
        requestOptions: { requestAgent: 'test' },
      });
      return null;
    }

    render(<Probe />);

    expect(result).toMatchObject({
      status: 'loading',
      nativeAd: null,
      error: null,
      autoLoad: true,
    });
    expect(NativeAd.createForAdRequest).toHaveBeenCalledWith(TestIds.NATIVE, {
      requestAgent: 'test',
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(result).toMatchObject({
      status: 'loaded',
      nativeAd: fake,
      error: null,
    });
  });

  it('destroys a late-resolving NativeAd after unmount and does not publish it', async () => {
    const deferred = createDeferredNativeAd();
    jest.spyOn(NativeAd, 'createForAdRequest').mockReturnValue(deferred.promise);
    const fake = createFakeNativeAd(TestIds.NATIVE);
    let result: UseNativeAdResult | undefined;

    function Probe() {
      result = useNativeAd({ adUnitId: TestIds.NATIVE });
      return null;
    }

    const view = render(<Probe />);
    expect(result!.status).toBe('loading');

    view.unmount();

    await act(async () => {
      deferred.resolve(fake);
      await deferred.promise;
    });

    expect(fake.destroy).toHaveBeenCalledTimes(1);
    // Unmounted probe must not have flipped to loaded with the leaked ad.
    expect(result!.status).toBe('loading');
    expect(result!.nativeAd).toBeNull();
  });

  it('keeps a loaded NativeAd when autoLoad flips false', async () => {
    const fake = createFakeNativeAd(TestIds.NATIVE);
    const create = jest.spyOn(NativeAd, 'createForAdRequest').mockResolvedValue(fake);
    let result: UseNativeAdResult | undefined;

    function Probe({ autoLoad }: { autoLoad: boolean }) {
      result = useNativeAd({ adUnitId: TestIds.NATIVE, autoLoad });
      return null;
    }

    const view = render(<Probe autoLoad />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(result).toMatchObject({
      status: 'loaded',
      nativeAd: fake,
      autoLoad: true,
    });

    view.rerender(<Probe autoLoad={false} />);
    expect(result).toMatchObject({
      status: 'loaded',
      nativeAd: fake,
      autoLoad: false,
    });
    expect(fake.destroy).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledTimes(1);

    // Flipping policy back on must not destroy or reload held inventory.
    view.rerender(<Probe autoLoad />);
    expect(result).toMatchObject({
      status: 'loaded',
      nativeAd: fake,
      autoLoad: true,
    });
    expect(fake.destroy).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('destroys the previous NativeAd when the ad unit identity changes', async () => {
    const first = createFakeNativeAd('unit-a');
    const second = createFakeNativeAd('unit-b');
    const create = jest
      .spyOn(NativeAd, 'createForAdRequest')
      .mockResolvedValueOnce(first)
      .mockResolvedValueOnce(second);
    let result: UseNativeAdResult | undefined;
    let adUnitId = 'unit-a';

    function Probe({ unitId }: { unitId: string }) {
      result = useNativeAd({ adUnitId: unitId });
      return null;
    }

    const view = render(<Probe unitId={adUnitId} />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(result!.status).toBe('loaded');
    expect(result!.nativeAd).toBe(first);

    adUnitId = 'unit-b';
    view.rerender(<Probe unitId={adUnitId} />);

    expect(first.destroy).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledTimes(2);

    await act(async () => {
      await Promise.resolve();
    });
    expect(result!.nativeAd).toBe(second);
    expect(second.destroy).not.toHaveBeenCalled();
  });

  it('destroys a superseded in-flight NativeAd when identity changes before resolve', async () => {
    const firstDeferred = createDeferredNativeAd();
    const secondDeferred = createDeferredNativeAd();
    jest
      .spyOn(NativeAd, 'createForAdRequest')
      .mockReturnValueOnce(firstDeferred.promise)
      .mockReturnValueOnce(secondDeferred.promise);
    const stale = createFakeNativeAd('unit-a');
    const fresh = createFakeNativeAd('unit-b');
    let result: UseNativeAdResult | undefined;

    function Probe({ unitId }: { unitId: string }) {
      result = useNativeAd({ adUnitId: unitId });
      return null;
    }

    const view = render(<Probe unitId="unit-a" />);
    expect(result!.status).toBe('loading');

    view.rerender(<Probe unitId="unit-b" />);
    expect(result!.status).toBe('loading');

    await act(async () => {
      firstDeferred.resolve(stale);
      await firstDeferred.promise;
    });
    expect(stale.destroy).toHaveBeenCalledTimes(1);
    expect(result!.nativeAd).toBeNull();

    await act(async () => {
      secondDeferred.resolve(fresh);
      await secondDeferred.promise;
    });
    expect(result!.status).toBe('loaded');
    expect(result!.nativeAd).toBe(fresh);
  });

  it('retry reloads after error and after destroy', async () => {
    const networkError = createAdError('network-error');
    const fake = createFakeNativeAd(TestIds.NATIVE);
    jest
      .spyOn(NativeAd, 'createForAdRequest')
      .mockRejectedValueOnce(networkError)
      .mockResolvedValueOnce(fake)
      .mockResolvedValueOnce(createFakeNativeAd(`${TestIds.NATIVE}-again`));
    let result: UseNativeAdResult | undefined;

    function Probe() {
      result = useNativeAd({ adUnitId: TestIds.NATIVE, autoLoad: false });
      return null;
    }

    render(<Probe />);
    expect(result!.status).toBe('idle');

    await act(async () => {
      result!.retry();
      await Promise.resolve();
    });
    expect(result!.status).toBe('error');
    expect(result!.error).toMatchObject({ reason: 'network-error' });
    expect(result!.nativeAd).toBeNull();

    await act(async () => {
      result!.retry();
      await Promise.resolve();
    });
    expect(result!.status).toBe('loaded');
    expect(result!.nativeAd).toBe(fake);

    act(() => {
      result!.destroy();
    });
    expect(result!.status).toBe('idle');
    expect(fake.destroy).toHaveBeenCalledTimes(1);
    expect(result!.nativeAd).toBeNull();

    await act(async () => {
      result!.retry();
      await Promise.resolve();
    });
    expect(result!.status).toBe('loaded');
    expect(NativeAd.createForAdRequest).toHaveBeenCalledTimes(3);
  });

  it('classifies load-phase no-fill separately from other errors', async () => {
    const noFill = createAdError('no-fill');
    jest.spyOn(NativeAd, 'createForAdRequest').mockRejectedValueOnce(noFill);
    let result: UseNativeAdResult | undefined;

    function Probe() {
      result = useNativeAd({ adUnitId: TestIds.NATIVE, autoLoad: false });
      return null;
    }

    render(<Probe />);
    await act(async () => {
      result!.retry();
      await Promise.resolve();
    });

    expect(result!.status).toBe('no-fill');
    expect(result!.error).toMatchObject({ reason: 'no-fill' });
  });

  it('stays idle when adUnitId is null', () => {
    const create = jest.spyOn(NativeAd, 'createForAdRequest');
    let result: UseNativeAdResult | undefined;

    function Probe() {
      result = useNativeAd({ adUnitId: null, autoLoad: true });
      return null;
    }

    render(<Probe />);
    expect(result).toMatchObject({
      status: 'idle',
      nativeAd: null,
      error: null,
      autoLoad: true,
    });
    expect(create).not.toHaveBeenCalled();
  });

  it('maps synchronous createForAdRequest throws to error status', () => {
    jest.spyOn(NativeAd, 'createForAdRequest').mockImplementation(() => {
      throw createAdError('network-error');
    });
    let result: UseNativeAdResult | undefined;

    function Probe() {
      result = useNativeAd({ adUnitId: TestIds.NATIVE, autoLoad: false });
      return null;
    }

    render(<Probe />);
    act(() => {
      result!.retry();
    });
    expect(result!.status).toBe('error');
    expect(result!.error).toMatchObject({ reason: 'network-error' });
  });

  it('coalesces concurrent retries onto one in-flight request', async () => {
    const deferred = createDeferredNativeAd();
    const create = jest
      .spyOn(NativeAd, 'createForAdRequest')
      .mockReturnValue(deferred.promise);
    const fake = createFakeNativeAd(TestIds.NATIVE);
    let result: UseNativeAdResult | undefined;

    function Probe() {
      result = useNativeAd({ adUnitId: TestIds.NATIVE, autoLoad: false });
      return null;
    }

    render(<Probe />);
    act(() => {
      result!.retry();
      result!.retry();
    });
    expect(create).toHaveBeenCalledTimes(1);

    await act(async () => {
      deferred.resolve(fake);
      await deferred.promise;
    });
    expect(result!.status).toBe('loaded');
  });

  it('ignores a stale rejection after identity change', async () => {
    const firstDeferred = createDeferredNativeAd();
    const second = createFakeNativeAd('unit-b');
    jest
      .spyOn(NativeAd, 'createForAdRequest')
      .mockReturnValueOnce(firstDeferred.promise)
      .mockResolvedValueOnce(second);
    let result: UseNativeAdResult | undefined;

    function Probe({ unitId }: { unitId: string }) {
      result = useNativeAd({ adUnitId: unitId });
      return null;
    }

    const view = render(<Probe unitId="unit-a" />);
    view.rerender(<Probe unitId="unit-b" />);

    await act(async () => {
      firstDeferred.reject(createAdError('network-error'));
      try {
        await firstDeferred.promise;
      } catch {
        // expected
      }
      await Promise.resolve();
    });

    expect(result!.status).toBe('loaded');
    expect(result!.nativeAd).toBe(second);
    expect(result!.error).toBeNull();
  });

  it('no-ops retry and destroy after unmount, and retry while adUnitId is null', async () => {
    const deferred = createDeferredNativeAd();
    const create = jest
      .spyOn(NativeAd, 'createForAdRequest')
      .mockReturnValue(deferred.promise);
    let result: UseNativeAdResult | undefined;
    let adUnitId: string | null = TestIds.NATIVE;

    function Probe({ unitId }: { unitId: string | null }) {
      result = useNativeAd({ adUnitId: unitId, autoLoad: false });
      return null;
    }

    const view = render(<Probe unitId={adUnitId} />);
    act(() => {
      result!.retry();
    });
    expect(result!.status).toBe('loading');
    expect(create).toHaveBeenCalledTimes(1);

    view.unmount();
    act(() => {
      result!.retry();
      result!.destroy();
    });
    expect(create).toHaveBeenCalledTimes(1);

    await act(async () => {
      deferred.resolve(createFakeNativeAd(TestIds.NATIVE));
      await deferred.promise;
    });

    adUnitId = null;
    const view2 = render(<Probe unitId={adUnitId} />);
    create.mockClear();
    act(() => {
      result!.retry();
    });
    expect(create).not.toHaveBeenCalled();
    expect(result!.status).toBe('idle');
    view2.unmount();
  });

  it('classifies mediation-no-fill as no-fill on the sync throw path', () => {
    jest.spyOn(NativeAd, 'createForAdRequest').mockImplementation(() => {
      throw createAdError('mediation-no-fill');
    });
    let result: UseNativeAdResult | undefined;

    function Probe() {
      result = useNativeAd({ adUnitId: TestIds.NATIVE, autoLoad: false });
      return null;
    }

    render(<Probe />);
    act(() => {
      result!.retry();
    });
    expect(result!.status).toBe('no-fill');
    expect(result!.error).toMatchObject({ reason: 'mediation-no-fill' });
  });
});
