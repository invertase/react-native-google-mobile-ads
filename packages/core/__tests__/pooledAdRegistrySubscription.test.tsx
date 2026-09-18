import React from 'react';
import { act, render } from '@testing-library/react-native';

import {
  AdFormat,
  AdPoolPresets,
  AdPools,
  useAdPool,
  usePooledAd,
  type AdPoolAvailability,
  type AdPoolEvent,
  type PollResult,
  type UsePooledAdResult,
} from '../src';
import {
  destroyAllAdPools,
  registerAdPool,
  unregisterAdPool,
  type RegisteredAdPool,
} from '../src/internal/adPoolRegistry';
import { validateAdPoolConfig } from '../src/validateAdPoolConfig';

/**
 * `usePooledAd` calls `useAdPool`, which already subscribes to the registry for
 * the same `poolId`. A second subscription inside `usePooledAd` re-read
 * availability on every unrelated registry change; the lookup the hook already
 * renders carries register / unregister. `pool.addListener` stays the source of
 * availability changes while a pool is registered.
 */

type ControlledPool = {
  pool: RegisteredAdPool;
  poolId: string;
  getAvailability: jest.Mock<Promise<AdPoolAvailability>, []>;
  poll: jest.Mock<Promise<PollResult>, []>;
  addListener: jest.Mock<() => void, [(event: AdPoolEvent) => void]>;
  emit: (event: AdPoolEvent) => void;
  listenerCount: () => number;
  unsubscribeCount: () => number;
};

function controlledPool(
  adUnitId: string,
  availability: AdPoolAvailability = { available: true, observedCount: 2 },
  poolId?: string,
): ControlledPool {
  const resolved = validateAdPoolConfig(
    AdPoolPresets.fullscreen(AdFormat.INTERSTITIAL, adUnitId, {
      bufferSize: 1,
      ...(poolId ? { poolId } : {}),
    }),
  );
  const listeners = new Set<(event: AdPoolEvent) => void>();
  let unsubscribes = 0;
  const getAvailability = jest.fn(async () => availability);
  const poll = jest.fn(async (): Promise<PollResult> => ({ status: 'empty' }));
  const addListener = jest.fn((listener: (event: AdPoolEvent) => void) => {
    listeners.add(listener);
    return () => {
      unsubscribes += 1;
      listeners.delete(listener);
    };
  });
  const pool = {
    poolId: resolved.poolId,
    formats: resolved.formats,
    resolved,
    getAvailability,
    peekResponseInfo: jest.fn(async () => null),
    poll,
    addListener,
    destroy: jest.fn(),
    notifyDegraded: jest.fn(),
  } as unknown as RegisteredAdPool;

  return {
    pool,
    poolId: resolved.poolId,
    getAvailability,
    poll,
    addListener,
    emit: event => {
      listeners.forEach(listener => listener(event));
    },
    listenerCount: () => listeners.size,
    unsubscribeCount: () => unsubscribes,
  };
}

/** Lets registry notify, the lookup re-render, and the availability read land. */
async function settle(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('usePooledAd registry subscription', () => {
  afterEach(() => {
    // Registry notify updates mounted hooks; keep teardown inside act.
    act(() => {
      destroyAllAdPools();
    });
    jest.restoreAllMocks();
  });

  it('subscribes to the registry only through useAdPool', () => {
    const subscribeSpy = jest.spyOn(
      require('../src/internal/adPoolRegistry'),
      'subscribeAdPoolRegistry',
    );

    function Pooled() {
      usePooledAd('subscription-count');
      return null;
    }
    function Lookup() {
      useAdPool('subscription-count');
      return null;
    }

    render(<Pooled />);
    const pooledSubscriptions = subscribeSpy.mock.calls.length;
    subscribeSpy.mockClear();
    render(<Lookup />);

    // One pooled hook costs exactly what its own lookup costs.
    expect(pooledSubscriptions).toBe(subscribeSpy.mock.calls.length);
    expect(pooledSubscriptions).toBe(1);
  });

  it('moves absent to ready and reads availability through the lookup', async () => {
    const controlled = controlledPool('registry-absent-to-ready');
    let pooled: UsePooledAdResult | undefined;
    function Probe() {
      pooled = usePooledAd(controlled.poolId);
      return null;
    }

    render(<Probe />);
    expect(pooled!.poolStatus).toBe('absent');
    expect(pooled!.available).toBe(false);
    expect(pooled!.observedCount).toBe(0);
    expect(controlled.getAvailability).not.toHaveBeenCalled();
    expect(controlled.listenerCount()).toBe(0);

    await act(async () => {
      registerAdPool(controlled.pool);
    });
    await settle();

    expect(pooled!.poolStatus).toBe('ready');
    expect(pooled!.available).toBe(true);
    expect(pooled!.observedCount).toBe(2);
    expect(controlled.listenerCount()).toBe(1);
    expect(controlled.getAvailability).toHaveBeenCalledTimes(1);
  });

  it('zeroes availability and drops the pool listener when the pool unregisters', async () => {
    const controlled = controlledPool('registry-unregister');
    registerAdPool(controlled.pool);
    let pooled: UsePooledAdResult | undefined;
    function Probe() {
      pooled = usePooledAd(controlled.poolId);
      return null;
    }

    render(<Probe />);
    await settle();
    expect(pooled!.available).toBe(true);
    expect(pooled!.observedCount).toBe(2);

    await act(async () => {
      unregisterAdPool(controlled.poolId);
    });
    await settle();

    expect(pooled!.poolStatus).toBe('absent');
    expect(pooled!.available).toBe(false);
    expect(pooled!.observedCount).toBe(0);
    expect(controlled.listenerCount()).toBe(0);
    expect(controlled.unsubscribeCount()).toBe(1);
  });

  it('still refreshes availability from pool events only', async () => {
    const controlled = controlledPool('registry-pool-events');
    registerAdPool(controlled.pool);
    let pooled: UsePooledAdResult | undefined;
    function Probe() {
      pooled = usePooledAd(controlled.poolId);
      return null;
    }

    render(<Probe />);
    await settle();
    expect(pooled!.available).toBe(true);
    const readsAfterMount = controlled.getAvailability.mock.calls.length;

    controlled.getAvailability.mockResolvedValue({ available: false, observedCount: 0 });
    await act(async () => {
      controlled.emit({ type: 'exhausted', poolId: controlled.poolId });
    });
    await settle();

    expect(controlled.getAvailability).toHaveBeenCalledTimes(readsAfterMount + 1);
    expect(pooled!.available).toBe(false);
    expect(pooled!.observedCount).toBe(0);

    controlled.getAvailability.mockResolvedValue({ available: true, observedCount: 3 });
    await act(async () => {
      controlled.emit({ type: 'available', poolId: controlled.poolId, responseId: 'resp-1' });
    });
    await settle();

    expect(controlled.getAvailability).toHaveBeenCalledTimes(readsAfterMount + 2);
    expect(pooled!.available).toBe(true);
    expect(pooled!.observedCount).toBe(3);

    // Not availability transitions.
    await act(async () => {
      controlled.emit({
        type: 'degraded',
        poolId: controlled.poolId,
        reasons: [],
        resolved: controlled.pool.resolved,
      });
    });
    await settle();
    expect(controlled.getAvailability).toHaveBeenCalledTimes(readsAfterMount + 2);
  });

  it('does not commit pooled state for absent unrelated-registry churn', async () => {
    const controlled = controlledPool('registry-churn-absent');
    let renders = 0;
    let commits = 0;
    let pooled: UsePooledAdResult | undefined;
    function Probe() {
      renders += 1;
      pooled = usePooledAd(controlled.poolId);
      return null;
    }

    render(
      <React.Profiler
        id="absent-registry-churn"
        onRender={() => {
          commits += 1;
        }}
      >
        <Probe />
      </React.Profiler>,
    );
    await settle();
    const afterMount = { renders, commits };

    await act(async () => {
      await AdPools.create(
        AdPoolPresets.fullscreen(AdFormat.REWARDED, 'registry-churn-other-absent'),
      );
    });
    await settle();

    // `useAdPool` receives the notification but returns its previous lookup
    // object because this id is still absent. With no second subscriber,
    // React has no pooled-state update to render or commit.
    expect({ renders, commits }).toEqual(afterMount);
    expect(controlled.getAvailability).not.toHaveBeenCalled();
    expect(pooled).toMatchObject({
      poolStatus: 'absent',
      available: false,
      observedCount: 0,
    });
  });

  it('does not re-read a ready pool for unrelated-registry churn', async () => {
    const controlled = controlledPool('registry-churn-ready');
    registerAdPool(controlled.pool);
    let pooled: UsePooledAdResult | undefined;
    function Probe() {
      pooled = usePooledAd(controlled.poolId);
      return null;
    }

    render(<Probe />);
    await settle();
    const readsAfterMount = controlled.getAvailability.mock.calls.length;

    await act(async () => {
      await AdPools.create(
        AdPoolPresets.fullscreen(AdFormat.REWARDED, 'registry-churn-other-ready'),
      );
    });
    await settle();

    expect(controlled.getAvailability).toHaveBeenCalledTimes(readsAfterMount);
    expect(pooled).toMatchObject({
      poolStatus: 'ready',
      available: true,
      observedCount: 2,
    });
  });

  it('keeps poll and release identity across registry transitions', async () => {
    const controlled = controlledPool('registry-identity');
    let pooled: UsePooledAdResult | undefined;
    function Probe() {
      pooled = usePooledAd(controlled.poolId);
      return null;
    }

    render(<Probe />);
    const atMount = { poll: pooled!.poll, release: pooled!.release };

    await act(async () => {
      registerAdPool(controlled.pool);
    });
    await settle();
    expect(pooled!.poll).toBe(atMount.poll);
    expect(pooled!.release).toBe(atMount.release);

    await act(async () => {
      unregisterAdPool(controlled.poolId);
    });
    await settle();
    expect(pooled!.poll).toBe(atMount.poll);
    expect(pooled!.release).toBe(atMount.release);
  });

  it('follows a poolId change to the newly looked-up pool', async () => {
    const first = controlledPool('registry-switch-a', { available: true, observedCount: 2 });
    const second = controlledPool('registry-switch-b', { available: false, observedCount: 0 });
    registerAdPool(first.pool);
    registerAdPool(second.pool);
    let pooled: UsePooledAdResult | undefined;
    function Probe({ poolId }: { poolId: string }) {
      pooled = usePooledAd(poolId);
      return null;
    }

    const view = render(<Probe poolId={first.poolId} />);
    await settle();
    expect(pooled!.available).toBe(true);

    await act(async () => {
      view.rerender(<Probe poolId={second.poolId} />);
    });
    await settle();

    expect(pooled!.poolStatus).toBe('ready');
    expect(pooled!.available).toBe(false);
    expect(pooled!.observedCount).toBe(0);
    expect(first.listenerCount()).toBe(0);
    expect(first.unsubscribeCount()).toBe(1);
    expect(second.listenerCount()).toBe(1);
  });

  it('moves one listener and current availability when the same poolId is replaced', async () => {
    const first = controlledPool('registry-replace-a', { available: true, observedCount: 2 });
    const second = controlledPool(
      'registry-replace-b',
      { available: false, observedCount: 0 },
      first.poolId,
    );
    let pooled: UsePooledAdResult | undefined;
    function Probe({ tick }: { tick: number }) {
      void tick;
      pooled = usePooledAd(first.poolId);
      return null;
    }

    registerAdPool(first.pool);
    const view = render(<Probe tick={0} />);
    await settle();
    expect(pooled).toMatchObject({
      poolStatus: 'ready',
      available: true,
      observedCount: 2,
    });
    expect(first.addListener).toHaveBeenCalledTimes(1);
    expect(first.listenerCount()).toBe(1);

    await act(async () => {
      registerAdPool(second.pool);
    });
    await settle();

    // The lookup object changes even though poolId and status do not. The
    // effect cleanup must run before B is attached and B's read must win.
    expect(first.unsubscribeCount()).toBe(1);
    expect(first.listenerCount()).toBe(0);
    expect(second.addListener).toHaveBeenCalledTimes(1);
    expect(second.listenerCount()).toBe(1);
    expect(pooled).toMatchObject({
      poolStatus: 'ready',
      available: false,
      observedCount: 0,
    });

    const firstReads = first.getAvailability.mock.calls.length;
    const secondReads = second.getAvailability.mock.calls.length;
    first.getAvailability.mockResolvedValue({ available: true, observedCount: 9 });
    await act(async () => {
      first.emit({ type: 'available', poolId: first.poolId, responseId: 'stale-a' });
    });
    await settle();
    // A's listener is detached, so the event reaches no hook callback at all:
    // neither A nor the pool this id now owns is read again.
    expect(first.getAvailability).toHaveBeenCalledTimes(firstReads);
    expect(second.getAvailability).toHaveBeenCalledTimes(secondReads);
    expect(pooled).toMatchObject({ available: false, observedCount: 0 });

    second.getAvailability.mockResolvedValue({ available: true, observedCount: 3 });
    await act(async () => {
      second.emit({ type: 'available', poolId: second.poolId, responseId: 'current-b' });
    });
    await settle();
    expect(pooled).toMatchObject({ available: true, observedCount: 3 });

    await act(async () => {
      view.rerender(<Probe tick={1} />);
      await AdPools.create(
        AdPoolPresets.fullscreen(AdFormat.REWARDED, 'registry-replace-unrelated'),
      );
    });
    await settle();
    expect(first.addListener).toHaveBeenCalledTimes(1);
    expect(first.listenerCount()).toBe(0);
    expect(second.addListener).toHaveBeenCalledTimes(1);
    expect(second.listenerCount()).toBe(1);
  });

  it('does not let a held read from a replaced pool overwrite its same-id successor', async () => {
    const first = controlledPool('registry-same-id-race-a', { available: true, observedCount: 2 });
    const second = controlledPool(
      'registry-same-id-race-b',
      { available: true, observedCount: 4 },
      first.poolId,
    );
    registerAdPool(first.pool);
    let pooled: UsePooledAdResult | undefined;
    function Probe() {
      pooled = usePooledAd(first.poolId);
      return null;
    }

    render(<Probe />);
    await settle();
    expect(pooled).toMatchObject({ poolStatus: 'ready', available: true, observedCount: 2 });
    expect(first.listenerCount()).toBe(1);

    // Hold A's read open while A still owns the id.
    let resolveHeldRead!: (availability: AdPoolAvailability) => void;
    first.getAvailability.mockReturnValueOnce(
      new Promise<AdPoolAvailability>(resolve => {
        resolveHeldRead = resolve;
      }),
    );
    await act(async () => {
      first.emit({ type: 'available', poolId: first.poolId, responseId: 'held-a' });
    });
    await settle();
    expect(first.getAvailability).toHaveBeenCalledTimes(2);
    expect(pooled).toMatchObject({ available: true, observedCount: 2 });

    // B takes the same id while A's read is still in flight.
    await act(async () => {
      registerAdPool(second.pool);
    });
    await settle();
    expect(second.getAvailability).toHaveBeenCalledTimes(1);
    expect(pooled).toMatchObject({ poolStatus: 'ready', available: true, observedCount: 4 });

    // A settles late with values no registered pool ever reported. The id is
    // unchanged and the hook is mounted, so only pool identity can reject it.
    await act(async () => {
      resolveHeldRead({ available: false, observedCount: 11 });
    });
    await settle();

    expect(pooled).toMatchObject({ poolStatus: 'ready', available: true, observedCount: 4 });
    expect(second.getAvailability).toHaveBeenCalledTimes(1);
    expect(first.addListener).toHaveBeenCalledTimes(1);
    expect(first.listenerCount()).toBe(0);
    expect(first.unsubscribeCount()).toBe(1);
    expect(second.addListener).toHaveBeenCalledTimes(1);
    expect(second.listenerCount()).toBe(1);
    expect(second.unsubscribeCount()).toBe(0);
  });

  it('zeroes availability when the pool unregisters while a poll is in flight', async () => {
    const controlled = controlledPool('registry-unregister-mid-poll');
    registerAdPool(controlled.pool);
    let resolvePoll!: (result: PollResult) => void;
    controlled.poll.mockReturnValueOnce(
      new Promise<PollResult>(resolve => {
        resolvePoll = resolve;
      }),
    );

    let pooled: UsePooledAdResult | undefined;
    function Probe() {
      pooled = usePooledAd(controlled.poolId);
      return null;
    }

    render(<Probe />);
    await settle();
    expect(pooled!.available).toBe(true);

    let pollPromise!: Promise<PollResult>;
    act(() => {
      pollPromise = pooled!.poll();
    });
    expect(pooled!.status).toBe('polling');

    await act(async () => {
      unregisterAdPool(controlled.poolId);
    });
    await settle();
    expect(pooled!.poolStatus).toBe('absent');

    await act(async () => {
      resolvePoll({ status: 'empty' });
      await expect(pollPromise).resolves.toEqual({ status: 'empty' });
    });
    await settle();

    // The result still publishes for the live id; availability cannot be read
    // from a pool the registry no longer has.
    expect(pooled!.status).toBe('empty');
    expect(pooled!.available).toBe(false);
    expect(pooled!.observedCount).toBe(0);
  });

  it('does not let an old-id availability read overwrite the current id', async () => {
    const first = controlledPool('registry-late-read-a');
    const second = controlledPool('registry-late-read-b', {
      available: false,
      observedCount: 0,
    });
    registerAdPool(first.pool);
    registerAdPool(second.pool);
    let resolveFirstAvailability!: (availability: AdPoolAvailability) => void;
    first.getAvailability.mockReturnValueOnce(
      new Promise<AdPoolAvailability>(resolve => {
        resolveFirstAvailability = resolve;
      }),
    );

    let pooled: UsePooledAdResult | undefined;
    function Probe({ poolId }: { poolId: string }) {
      pooled = usePooledAd(poolId);
      return null;
    }

    const view = render(<Probe poolId={first.poolId} />);
    await settle();
    expect(first.getAvailability).toHaveBeenCalledTimes(1);

    await act(async () => {
      view.rerender(<Probe poolId={second.poolId} />);
    });
    await settle();
    expect(pooled).toMatchObject({
      poolStatus: 'ready',
      available: false,
      observedCount: 0,
    });

    resolveFirstAvailability({ available: true, observedCount: 5 });
    await settle();

    // React 19 intentionally makes post-unmount setState inert, so warnings
    // are not a valid oracle. The id guard is directly observable here: A's
    // late value cannot overwrite B's current state.
    expect(pooled).toMatchObject({
      poolStatus: 'ready',
      available: false,
      observedCount: 0,
    });
  });
});
