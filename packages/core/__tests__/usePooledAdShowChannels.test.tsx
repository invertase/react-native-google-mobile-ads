import React from 'react';
import { act, render } from '@testing-library/react-native';

import {
  AdEventType,
  AdFormat,
  AdPoolPresets,
  AdPools,
  usePooledAd,
  type PooledAd,
  type UsePooledAdResult,
} from '../src';
import { destroyAllAdPools } from '../src/internal/adPoolRegistry';

/**
 * SH-2: `usePooledAd` wraps a fullscreen pooled ad's `show()` to drive the
 * `'consumed'` transition. That wrapper must preserve `PooledAd.show()`'s
 * two-channel contract — a synchronous throw for destroyed / invalid options,
 * a promise rejection for decline / not-loaded / already-requested — rather
 * than flattening both into one rejection (which an `async` wrapper would do).
 */

type ClosedListener = () => void;

function controlledFullscreenAd(show: jest.Mock) {
  let closedListener: ClosedListener | undefined;
  const destroy = jest.fn();
  const offClosed = jest.fn();
  const addAdEventListener = jest.fn((type: AdEventType, listener: ClosedListener) => {
    if (type === AdEventType.CLOSED) {
      closedListener = listener;
    }
    return offClosed;
  });
  const ad = {
    format: AdFormat.INTERSTITIAL,
    destroy,
    show,
    addAdEventListener,
    onStaleByPolicy: jest.fn(() => jest.fn()),
  } as unknown as PooledAd;
  return {
    ad,
    destroy,
    addAdEventListener,
    offClosed,
    emitClosed: () => closedListener?.(),
  };
}

async function fillWith(poolIdSuffix: string, innerShow: jest.Mock) {
  const config = AdPoolPresets.fullscreen(AdFormat.INTERSTITIAL, poolIdSuffix);
  const pool = await AdPools.create(config);
  const fake = controlledFullscreenAd(innerShow);
  jest.spyOn(pool, 'poll').mockResolvedValueOnce({ status: 'filled', ad: fake.ad });

  let pooled: UsePooledAdResult | undefined;
  function Probe() {
    pooled = usePooledAd(config.poolId);
    return null;
  }
  render(<Probe />);
  await act(async () => {
    await pooled!.poll();
    await Promise.resolve();
  });
  expect(pooled!.status).toBe('filled');
  return { fake, read: () => pooled!, innerShow };
}

describe('usePooledAd show() preserves the two-channel contract (SH-2)', () => {
  afterEach(() => {
    act(() => {
      destroyAllAdPools();
    });
    jest.restoreAllMocks();
  });

  it('wraps show without changing its identity to the inner show', async () => {
    const innerShow = jest.fn(() => Promise.resolve());
    const { fake, read } = await fillWith('sh2-wrapped', innerShow);
    expect(read().ad!.show).not.toBe(innerShow);
    expect(fake.addAdEventListener).not.toHaveBeenCalled(); // only on an actual show()
  });

  it('propagates a synchronous throw (destroyed / invalid options) without a rejection', async () => {
    const innerShow = jest.fn(() => {
      throw new Error('The requested InterstitialAd has been destroyed.');
    });
    const { fake, read } = await fillWith('sh2-sync-throw', innerShow);

    // Sync channel preserved: the wrapper throws synchronously (no promise), so
    // there is nothing to `.catch`, and no close listener is attached/leaked.
    expect(() => read().ad!.show()).toThrow(/destroyed/);
    expect(fake.addAdEventListener).not.toHaveBeenCalled();
    expect(read().status).toBe('filled'); // not consumed
  });

  it('preserves a promise rejection (decline / already-requested) as a rejection', async () => {
    const innerShow = jest.fn(() =>
      Promise.reject(new Error('Show has already been requested for this InterstitialAd.')),
    );
    const { fake, read } = await fillWith('sh2-reject', innerShow);

    await act(async () => {
      await expect(read().ad!.show()).rejects.toThrow(/already been requested/);
    });
    // Listener was attached for the attempt, then removed on rejection.
    expect(fake.addAdEventListener).toHaveBeenCalledTimes(1);
    expect(fake.offClosed).toHaveBeenCalledTimes(1);
    expect(read().status).toBe('filled'); // not consumed
  });

  it('marks the hook consumed on a successful show followed by CLOSED', async () => {
    const innerShow = jest.fn(() => Promise.resolve());
    const { fake, read } = await fillWith('sh2-consumed', innerShow);

    await act(async () => {
      await read().ad!.show();
      await Promise.resolve();
    });
    expect(fake.addAdEventListener).toHaveBeenCalledTimes(1);

    await act(async () => {
      fake.emitClosed();
      await Promise.resolve();
    });
    expect(read().status).toBe('consumed');
    expect(read().ad).toBeNull();
    expect(fake.destroy).toHaveBeenCalledTimes(1);
  });
});
