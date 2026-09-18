import React from 'react';
import { act, render } from '@testing-library/react-native';

import {
  AdEventType,
  InterstitialAd,
  TestIds,
  useInterstitialAd,
  type UseInterstitialAdResult,
} from '../src';

/**
 * Fullscreen core state resets by applying the whole `initialCoreState`: on
 * mount, on every new ad instance, and from options-form `destroy()`. When the
 * hook is already idle that update says nothing new, so the `useState` updater
 * returns the state object it already has and React commits nothing. These
 * tests count Profiler commits and hook-result identity rather than reading
 * state, because an unconditional spread produces exactly the same `status`
 * while still re-rendering.
 */

type TestAdEventsListener = (event: { type: AdEventType; payload: unknown }) => void;

function createTestInterstitial() {
  let listener: TestAdEventsListener | undefined;
  const unsubscribe = jest.fn();
  const ad = {
    addAdEventsListener: jest.fn((nextListener: TestAdEventsListener) => {
      listener = nextListener;
      return unsubscribe;
    }),
    destroy: jest.fn(),
    load: jest.fn(),
    responseInfo: null,
    show: jest.fn(),
  } as unknown as InterstitialAd;

  return {
    ad,
    emit(type: AdEventType, payload?: unknown) {
      listener?.({ type, payload });
    },
  };
}

describe('fullscreen state identity', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('does not commit when a reset repeats the idle state the hook already has', () => {
    const fake = createTestInterstitial();
    const replacement = createTestInterstitial();
    jest
      .spyOn(InterstitialAd, 'createForAdRequest')
      .mockReturnValueOnce(fake.ad)
      .mockReturnValue(replacement.ad);

    let renders = 0;
    let commits = 0;
    let result: UseInterstitialAdResult | undefined;

    function Probe({ adUnitId }: { adUnitId: string | null }) {
      renders += 1;
      result = useInterstitialAd({ adUnitId, autoLoad: false });
      return null;
    }

    function Tree({ adUnitId }: { adUnitId: string | null }) {
      return (
        <React.Profiler
          id="fullscreen-idle-reset"
          onRender={() => {
            commits += 1;
          }}
        >
          <Probe adUnitId={adUnitId} />
        </React.Profiler>
      );
    }

    const view = render(<Tree adUnitId={null} />);
    expect(result).toMatchObject({ status: 'idle', autoLoad: false });

    // No ad unit, so `destroy()` only dispatches the reset. Nothing to commit.
    const idle = { renders, commits };
    const idleResult = result;
    act(() => result!.destroy());
    act(() => result!.destroy());
    expect({ renders, commits }).toEqual(idle);
    expect(result).toBe(idleResult);
    expect(result).toMatchObject({ status: 'idle', autoLoad: false });

    // Real changes still publish: a new ad instance, then a load.
    view.rerender(<Tree adUnitId={TestIds.INTERSTITIAL} />);
    expect(commits).toBeGreaterThan(idle.commits);
    expect(renders).toBeGreaterThan(idle.renders);
    expect(result).toMatchObject({ status: 'idle' });

    const beforeLoad = { renders, commits };
    act(() => result!.load());
    expect(result!.status).toBe('loading');
    expect(commits).toBeGreaterThan(beforeLoad.commits);

    const beforeLoaded = { renders, commits };
    act(() => fake.emit(AdEventType.LOADED));
    expect(result!.status).toBe('loaded');
    expect(commits).toBeGreaterThan(beforeLoaded.commits);

    // A reset that actually changes state still commits.
    const beforeDestroy = { renders, commits };
    act(() => result!.destroy());
    expect(result!.status).toBe('idle');
    expect(commits).toBeGreaterThan(beforeDestroy.commits);

    // And the next redundant reset bails out again, so the bail-out is not a
    // one-shot property of the module-level initial state object.
    view.rerender(<Tree adUnitId={null} />);
    const idleAgain = { renders, commits };
    const idleAgainResult = result;
    act(() => result!.destroy());
    expect({ renders, commits }).toEqual(idleAgain);
    expect(result).toBe(idleAgainResult);
    expect(result).toMatchObject({ status: 'idle', error: null });
  });

  it('does not commit when an ad event repeats state, but still publishes new facts', () => {
    const fake = createTestInterstitial();
    jest.spyOn(InterstitialAd, 'createForAdRequest').mockReturnValue(fake.ad);

    let renders = 0;
    let commits = 0;
    let result: UseInterstitialAdResult | undefined;

    function Probe() {
      renders += 1;
      result = useInterstitialAd({ adUnitId: TestIds.INTERSTITIAL, autoLoad: false });
      return null;
    }

    render(
      <React.Profiler
        id="fullscreen-repeat-event"
        onRender={() => {
          commits += 1;
        }}
      >
        <Probe />
      </React.Profiler>,
    );

    act(() => result!.load());
    act(() => fake.emit(AdEventType.LOADED));
    expect(result!.status).toBe('loaded');

    // React may render a component once more after an update that resolves to
    // the state it already has; the bail-out is guaranteed from the next one
    // on. Absorb that render so the counts below measure the settled behavior.
    act(() => fake.emit(AdEventType.LOADED));

    // Same status, same `loaded`, same (null) responseInfo.
    const loaded = { renders, commits };
    const loadedResult = result;
    act(() => fake.emit(AdEventType.LOADED));
    act(() => fake.emit(AdEventType.LOADED));
    expect({ renders, commits }).toEqual(loaded);
    expect(result).toBe(loadedResult);
    expect(result!.status).toBe('loaded');

    // Partial updates are not suppressed: the first click publishes.
    act(() => fake.emit(AdEventType.CLICKED));
    expect(result!.clicked).toBe(true);
    expect(commits).toBeGreaterThan(loaded.commits);

    act(() => fake.emit(AdEventType.CLICKED));
    const clicked = { renders, commits };
    act(() => fake.emit(AdEventType.CLICKED));
    act(() => fake.emit(AdEventType.CLICKED));
    expect({ renders, commits }).toEqual(clicked);
    expect(result!.clicked).toBe(true);

    // A different accumulating fact still lands after the bail-out.
    act(() => fake.emit(AdEventType.IMPRESSION));
    expect(result!.impression).toBe(true);
    expect(commits).toBeGreaterThan(clicked.commits);

    const impression = { renders, commits };
    act(() => fake.emit(AdEventType.CLOSED));
    expect(result!.status).toBe('closed');
    expect(commits).toBeGreaterThan(impression.commits);
  });

  it('keeps the bail-out under StrictMode double invocation', () => {
    let renders = 0;
    let commits = 0;
    let result: UseInterstitialAdResult | undefined;

    function Probe() {
      renders += 1;
      result = useInterstitialAd({ adUnitId: null, autoLoad: false });
      return null;
    }

    // StrictMode double-invokes state updaters, so the bail-out only survives
    // while the merge stays pure and compares by value rather than by identity.
    render(
      <React.StrictMode>
        <React.Profiler
          id="fullscreen-strict-reset"
          onRender={() => {
            commits += 1;
          }}
        >
          <Probe />
        </React.Profiler>
      </React.StrictMode>,
    );
    expect(result!.status).toBe('idle');

    const idle = { renders, commits };
    const idleResult = result;
    act(() => result!.destroy());
    act(() => result!.destroy());
    expect({ renders, commits }).toEqual(idle);
    expect(result).toBe(idleResult);
    expect(result!.status).toBe('idle');
  });
});
