import React from 'react';
import { act, render } from '@testing-library/react-native';

import { AdFormat, AdPoolPresets, AdPoolProvider, AdPools, BannerAdSize } from '../src';
import { destroyAllAdPools, unregisterAdPool } from '../src/internal/adPoolRegistry';
import { SharedEventEmitter } from '../src/internal/SharedEventEmitter';
import NativeGoogleMobileAdsPoolModule from '../src/specs/modules/NativeGoogleMobileAdsPoolModule';

type Deferred<T> = {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(error: unknown): void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('ad pool generation ownership', () => {
  afterEach(() => {
    destroyAllAdPools();
    jest.clearAllMocks();
  });

  it('does not expose unused native event-emitter methods', () => {
    expect(NativeGoogleMobileAdsPoolModule).not.toHaveProperty('addListener');
    expect(NativeGoogleMobileAdsPoolModule).not.toHaveProperty('removeListeners');
  });

  it('sync same-format overlap only starts the latest generation', async () => {
    (NativeGoogleMobileAdsPoolModule.poolStart as jest.Mock).mockResolvedValue({
      started: true,
      effectiveBufferSize: 1,
    });
    const config = AdPoolPresets.fullscreen(AdFormat.INTERSTITIAL, 'sync-overlap');
    const older = AdPools.create(config);
    const latest = AdPools.create(config);
    const [olderResult, latestResult] = await Promise.all([older, latest]);
    expect(olderResult).toBe(latestResult);
    expect(AdPools.get(config.poolId)).toBe(latestResult);
    expect(NativeGoogleMobileAdsPoolModule.poolStart).toHaveBeenCalledTimes(1);
    expect(NativeGoogleMobileAdsPoolModule.poolStart).toHaveBeenCalledWith(
      config.poolId,
      AdFormat.INTERSTITIAL,
      expect.any(Number),
      config.adUnitId,
      expect.any(Number),
      expect.any(Object),
    );
  });

  it.each(['older-first', 'latest-first'])(
    'in-flight same-format create wins when %s settles',
    async order => {
      const starts = new Map<number, Deferred<{ started: boolean; effectiveBufferSize: number }>>();
      (NativeGoogleMobileAdsPoolModule.poolStart as jest.Mock).mockImplementation(
        (_id, _format, generation) => {
          const start = deferred<{ started: boolean; effectiveBufferSize: number }>();
          starts.set(generation, start);
          return start.promise;
        },
      );
      const config = AdPoolPresets.fullscreen(AdFormat.INTERSTITIAL, 'overlap-unit');
      const older = AdPools.create(config);
      await Promise.resolve();
      expect(starts.size).toBe(1);
      const firstGeneration = [...starts.keys()][0];

      const latest = AdPools.create(config);
      await Promise.resolve();
      expect(starts.size).toBe(2);
      const secondGeneration = [...starts.keys()].find(
        generation => generation !== firstGeneration,
      );
      expect(secondGeneration).toBeDefined();

      expect(NativeGoogleMobileAdsPoolModule.poolDestroy).toHaveBeenCalledWith(
        config.poolId,
        AdFormat.INTERSTITIAL,
        firstGeneration,
      );

      if (order === 'older-first') {
        starts.get(firstGeneration)!.resolve({ started: true, effectiveBufferSize: 1 });
        await Promise.resolve();
        starts.get(secondGeneration)!.resolve({ started: true, effectiveBufferSize: 1 });
      } else {
        starts.get(secondGeneration)!.resolve({ started: true, effectiveBufferSize: 1 });
        await Promise.resolve();
        starts.get(firstGeneration)!.resolve({ started: true, effectiveBufferSize: 1 });
      }

      const [olderResult, latestResult] = await Promise.all([older, latest]);
      expect(olderResult).toBe(latestResult);
      expect(AdPools.get(config.poolId)).toBe(latestResult);
      latestResult.destroy();
      expect(NativeGoogleMobileAdsPoolModule.poolDestroy).toHaveBeenCalledWith(
        config.poolId,
        AdFormat.INTERSTITIAL,
        secondGeneration,
      );
    },
  );

  it('different-format overlap returns the exact latest winner and filters stale events', async () => {
    const starts: Deferred<{ started: boolean; effectiveBufferSize: number }>[] = [];
    (NativeGoogleMobileAdsPoolModule.poolStart as jest.Mock).mockImplementation(() => {
      const start = deferred<{ started: boolean; effectiveBufferSize: number }>();
      starts.push(start);
      return start.promise;
    });
    const olderConfig = {
      ...AdPoolPresets.fullscreen(AdFormat.INTERSTITIAL, 'older-unit'),
      poolId: 'same-id',
    };
    const latestConfig = {
      ...AdPoolPresets.fullscreen(AdFormat.REWARDED, 'latest-unit'),
      poolId: 'same-id',
    };
    const older = AdPools.create(olderConfig);
    await Promise.resolve();
    const latest = AdPools.create(latestConfig);
    await Promise.resolve();
    expect(starts).toHaveLength(2);
    expect(NativeGoogleMobileAdsPoolModule.poolDestroy).toHaveBeenCalledWith(
      olderConfig.poolId,
      AdFormat.INTERSTITIAL,
      (NativeGoogleMobileAdsPoolModule.poolStart as jest.Mock).mock.calls[0][2],
    );

    starts[1].resolve({ started: true, effectiveBufferSize: 1 });
    const winner = await latest;
    const events = jest.fn();
    winner.addListener(events);
    const startCalls = (NativeGoogleMobileAdsPoolModule.poolStart as jest.Mock).mock.calls;
    const staleGeneration = startCalls[0][2];
    const winnerGeneration = startCalls[1][2];

    SharedEventEmitter.emit(`google_mobile_ads_pool_event:${winner.poolId}:0`, {
      body: { type: 'available', data: { responseId: 'stale', generation: staleGeneration } },
    });
    SharedEventEmitter.emit(`google_mobile_ads_pool_event:${winner.poolId}:0`, {
      body: { type: 'available', data: { responseId: 'winner', generation: winnerGeneration } },
    });
    expect(events).toHaveBeenCalledTimes(1);

    starts[0].reject(new Error('stale start failed'));
    await expect(older).resolves.toBe(winner);
    await Promise.resolve();
    expect(AdPools.get(winner.poolId)).toBe(winner);
  });

  it('adopts the latest failure for every overlapping caller', async () => {
    const starts = [
      deferred<{ started: boolean; effectiveBufferSize: number }>(),
      deferred<{ started: boolean; effectiveBufferSize: number }>(),
    ];
    (NativeGoogleMobileAdsPoolModule.poolStart as jest.Mock)
      .mockImplementationOnce(() => starts[0].promise)
      .mockImplementationOnce(() => starts[1].promise);
    const config = AdPoolPresets.fullscreen(AdFormat.APP_OPEN, 'failure');
    const older = AdPools.create(config);
    await Promise.resolve();
    const latest = AdPools.create(config);
    await Promise.resolve();
    const failure = new Error('latest failed');
    starts[1].reject(failure);
    const latestExpectation = expect(latest).rejects.toBe(failure);
    starts[0].resolve({ started: true, effectiveBufferSize: 1 });
    await latestExpectation;
    await expect(older).rejects.toBe(failure);
    expect(AdPools.get(config.poolId)).toBeNull();
  });

  it('sequential replace destroys the previous generation then owns the next', async () => {
    (NativeGoogleMobileAdsPoolModule.poolStart as jest.Mock).mockResolvedValue({
      started: true,
      effectiveBufferSize: 1,
    });
    const config = AdPoolPresets.fullscreen(AdFormat.INTERSTITIAL, 'sequential');
    const first = await AdPools.create(config);
    const firstGeneration = (NativeGoogleMobileAdsPoolModule.poolStart as jest.Mock).mock.calls[0][2];
    const second = await AdPools.create(config);
    const secondGeneration = (NativeGoogleMobileAdsPoolModule.poolStart as jest.Mock).mock
      .calls[1][2];
    expect(first).not.toBe(second);
    expect(AdPools.get(config.poolId)).toBe(second);
    expect(NativeGoogleMobileAdsPoolModule.poolDestroy).toHaveBeenCalledWith(
      config.poolId,
      AdFormat.INTERSTITIAL,
      firstGeneration,
    );
    second.destroy();
    expect(NativeGoogleMobileAdsPoolModule.poolDestroy).toHaveBeenCalledWith(
      config.poolId,
      AdFormat.INTERSTITIAL,
      secondGeneration,
    );
    expect(AdPools.get(config.poolId)).toBeNull();
  });

  it('direct destroy of a registered pool uses its generation and abandons listeners', async () => {
    (NativeGoogleMobileAdsPoolModule.poolStart as jest.Mock).mockResolvedValue({
      started: true,
      effectiveBufferSize: 1,
    });
    const config = AdPoolPresets.fullscreen(AdFormat.REWARDED, 'direct-destroy');
    const pool = await AdPools.create(config);
    const generation = (NativeGoogleMobileAdsPoolModule.poolStart as jest.Mock).mock.calls[0][2];
    const events = jest.fn();
    pool.addListener(events);
    (NativeGoogleMobileAdsPoolModule.poolGetAvailability as jest.Mock).mockResolvedValue({
      available: true,
      observedCount: 1,
    });
    await pool.getAvailability();
    await pool.peekResponseInfo();
    await pool.poll();
    expect(NativeGoogleMobileAdsPoolModule.poolGetAvailability).toHaveBeenCalledWith(
      config.poolId,
      AdFormat.REWARDED,
      generation,
    );
    expect(NativeGoogleMobileAdsPoolModule.poolPeekResponseInfo).toHaveBeenCalledWith(
      config.poolId,
      AdFormat.REWARDED,
      generation,
    );
    expect(NativeGoogleMobileAdsPoolModule.poolPoll).toHaveBeenCalledWith(
      config.poolId,
      AdFormat.REWARDED,
      generation,
      expect.any(Number),
      config.adUnitId,
    );
    pool.destroy();
    expect(NativeGoogleMobileAdsPoolModule.poolDestroy).toHaveBeenCalledWith(
      config.poolId,
      AdFormat.REWARDED,
      generation,
    );
    SharedEventEmitter.emit(`google_mobile_ads_pool_event:${pool.poolId}:0`, {
      body: { type: 'available', data: { responseId: 'late', generation } },
    });
    expect(events).not.toHaveBeenCalled();
    expect(AdPools.get(config.poolId)).toBeNull();
  });

  it('destroyAll cancels a pending generation without affecting a later create', async () => {
    const pending = deferred<{ started: boolean; effectiveBufferSize: number }>();
    (NativeGoogleMobileAdsPoolModule.poolStart as jest.Mock).mockImplementationOnce(
      () => pending.promise,
    );
    const config = AdPoolPresets.fullscreen(AdFormat.REWARDED, 'destroy-pending');
    const abandoned = AdPools.create(config);
    await Promise.resolve();
    const abandonedExpectation = expect(abandoned).rejects.toMatchObject({
      reason: 'internal-error',
    });
    AdPools.destroyAll();
    await abandonedExpectation;
    pending.resolve({ started: true, effectiveBufferSize: 1 });
    await Promise.resolve();
    await Promise.resolve();

    (NativeGoogleMobileAdsPoolModule.poolStart as jest.Mock).mockResolvedValueOnce({
      started: true,
      effectiveBufferSize: 1,
    });
    const winner = await AdPools.create(config);
    expect(AdPools.get(config.poolId)).toBe(winner);
  });

  it('unregister cancels pending native ownership', async () => {
    const pending = deferred<{ started: boolean; effectiveBufferSize: number }>();
    (NativeGoogleMobileAdsPoolModule.poolStart as jest.Mock).mockReturnValueOnce(pending.promise);
    const config = {
      ...AdPoolPresets.fullscreen(AdFormat.INTERSTITIAL, 'unregister-unit'),
      poolId: 'unregister-pending',
    };
    const creation = AdPools.create(config);
    await Promise.resolve();
    const generation = (NativeGoogleMobileAdsPoolModule.poolStart as jest.Mock).mock.calls[0][2];
    const expectation = expect(creation).rejects.toMatchObject({ reason: 'internal-error' });
    unregisterAdPool(config.poolId);
    await expectation;
    expect(NativeGoogleMobileAdsPoolModule.poolDestroy).toHaveBeenCalledWith(
      config.poolId,
      AdFormat.INTERSTITIAL,
      generation,
    );
    pending.resolve({ started: true, effectiveBufferSize: 1 });
  });

  it('settles cancellation and clears ownership when native destroy throws', async () => {
    const pending = deferred<{ started: boolean; effectiveBufferSize: number }>();
    (NativeGoogleMobileAdsPoolModule.poolStart as jest.Mock).mockReturnValueOnce(pending.promise);
    const config = AdPoolPresets.fullscreen(AdFormat.INTERSTITIAL, 'destroy-throws');
    const creation = AdPools.create(config);
    await Promise.resolve();
    const cancellation = expect(creation).rejects.toMatchObject({ reason: 'internal-error' });
    const nativeFailure = new Error('native destroy failed');
    (NativeGoogleMobileAdsPoolModule.poolDestroy as jest.Mock).mockImplementationOnce(() => {
      throw nativeFailure;
    });

    expect(() => unregisterAdPool(config.poolId)).not.toThrow();
    await cancellation;
    pending.resolve({ started: true, effectiveBufferSize: 1 });
    await Promise.resolve();

    (NativeGoogleMobileAdsPoolModule.poolStart as jest.Mock).mockResolvedValueOnce({
      started: true,
      effectiveBufferSize: 1,
    });
    const replacement = await AdPools.create(config);
    expect(AdPools.get(config.poolId)).toBe(replacement);
  });

  it('destroyAll settles every pending creation when each native destroy throws', async () => {
    const firstStart = deferred<{ started: boolean; effectiveBufferSize: number }>();
    const secondStart = deferred<{ started: boolean; effectiveBufferSize: number }>();
    (NativeGoogleMobileAdsPoolModule.poolStart as jest.Mock)
      .mockReturnValueOnce(firstStart.promise)
      .mockReturnValueOnce(secondStart.promise);
    const firstConfig = AdPoolPresets.fullscreen(AdFormat.INTERSTITIAL, 'destroy-all-first');
    const secondConfig = AdPoolPresets.fullscreen(AdFormat.REWARDED, 'destroy-all-second');
    const first = AdPools.create(firstConfig);
    const second = AdPools.create(secondConfig);
    await Promise.resolve();
    const firstCancellation = expect(first).rejects.toMatchObject({ reason: 'internal-error' });
    const secondCancellation = expect(second).rejects.toMatchObject({ reason: 'internal-error' });
    (NativeGoogleMobileAdsPoolModule.poolDestroy as jest.Mock).mockImplementation(() => {
      throw new Error('native destroy failed');
    });

    expect(() => AdPools.destroyAll()).not.toThrow();
    await Promise.all([firstCancellation, secondCancellation]);
    firstStart.resolve({ started: true, effectiveBufferSize: 1 });
    secondStart.resolve({ started: true, effectiveBufferSize: 1 });
    await Promise.resolve();
    expect(AdPools.get(firstConfig.poolId)).toBeNull();
    expect(AdPools.get(secondConfig.poolId)).toBeNull();
  });

  it('retry after failure creates a fresh generation', async () => {
    (NativeGoogleMobileAdsPoolModule.poolStart as jest.Mock)
      .mockRejectedValueOnce(new Error('transient'))
      .mockResolvedValueOnce({ started: true, effectiveBufferSize: 1 });
    const config = AdPoolPresets.fullscreen(AdFormat.INTERSTITIAL, 'retry');
    await expect(AdPools.create(config)).rejects.toThrow('transient');
    expect(AdPools.get(config.poolId)).toBeNull();
    const recovered = await AdPools.create(config);
    expect(AdPools.get(config.poolId)).toBe(recovered);
    const generations = (NativeGoogleMobileAdsPoolModule.poolStart as jest.Mock).mock.calls.map(
      call => call[2],
    );
    expect(generations[1]).toBeGreaterThan(generations[0]);
  });

  it('contains a synchronous native start throw and releases its generation', async () => {
    const nativeFailure = new Error('Exception in HostFunction: unknown');
    (NativeGoogleMobileAdsPoolModule.poolStart as jest.Mock).mockImplementationOnce(() => {
      throw nativeFailure;
    });
    const config = AdPoolPresets.fullscreen(AdFormat.INTERSTITIAL, 'sync-start-throws');

    await expect(AdPools.create(config)).rejects.toMatchObject({
      reason: 'internal-error',
      message: expect.stringContaining('native start failed'),
    });
    const generation = (NativeGoogleMobileAdsPoolModule.poolStart as jest.Mock).mock.calls[0][2];
    expect(NativeGoogleMobileAdsPoolModule.poolDestroy).toHaveBeenCalledWith(
      config.poolId,
      AdFormat.INTERSTITIAL,
      generation,
    );
    expect(AdPools.get(config.poolId)).toBeNull();
  });

  it('rejects started false without constructing a listener-backed pool', async () => {
    (NativeGoogleMobileAdsPoolModule.poolStart as jest.Mock).mockResolvedValueOnce({
      started: false,
      effectiveBufferSize: 1,
    });
    const config = AdPoolPresets.fullscreen(AdFormat.INTERSTITIAL, 'not-started');
    await expect(AdPools.create(config)).rejects.toMatchObject({
      reason: 'internal-error',
    });
    const generation = (NativeGoogleMobileAdsPoolModule.poolStart as jest.Mock).mock.calls[0][2];
    expect(NativeGoogleMobileAdsPoolModule.poolDestroy).toHaveBeenCalledWith(
      config.poolId,
      AdFormat.INTERSTITIAL,
      generation,
    );
    expect(AdPools.get(config.poolId)).toBeNull();
  });

  it('StrictMode remount settles on one live generation', async () => {
    (NativeGoogleMobileAdsPoolModule.poolStart as jest.Mock).mockResolvedValue({
      started: true,
      effectiveBufferSize: 1,
    });
    const config = AdPoolPresets.fullscreen(AdFormat.INTERSTITIAL, 'strict-mode');
    const view = render(
      <React.StrictMode>
        <AdPoolProvider pools={[config]}>
          <React.Fragment />
        </AdPoolProvider>
      </React.StrictMode>,
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    const live = AdPools.get(config.poolId);
    expect(live).not.toBeNull();
    const startCalls = (NativeGoogleMobileAdsPoolModule.poolStart as jest.Mock).mock.calls;
    expect(startCalls).toHaveLength(1);
    const liveGeneration = startCalls[startCalls.length - 1][2];
    live!.destroy();
    expect(NativeGoogleMobileAdsPoolModule.poolDestroy).toHaveBeenCalledWith(
      config.poolId,
      AdFormat.INTERSTITIAL,
      liveGeneration,
    );
    view.unmount();
  });

  it('emulated display overlap returns the exact latest winner', async () => {
    const config = AdPoolPresets.display('/123/example', {
      poolId: 'emulated-overlap',
      bannerSizes: [BannerAdSize.BANNER],
    });
    const older = AdPools.create(config);
    const latest = AdPools.create(config);
    const [olderResult, latestResult] = await Promise.all([older, latest]);
    expect(olderResult).toBe(latestResult);
    expect(AdPools.get(config.poolId)).toBe(latestResult);
    expect(NativeGoogleMobileAdsPoolModule.poolStart).not.toHaveBeenCalled();
    latestResult.destroy();
    expect(AdPools.get(config.poolId)).toBeNull();
  });
});
