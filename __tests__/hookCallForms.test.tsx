import React from 'react';
import { act, render } from '@testing-library/react-native';

import {
  AdEventType,
  AdFormat,
  InterstitialAd,
  RewardedAd,
  RewardedAdEventType,
  RewardedInterstitialAd,
  TestIds,
  useAppOpenAd,
  useInterstitialAd,
  useMultiFormatAd,
  useRewardedAd,
  useRewardedInterstitialAd,
  type AdError,
  type ResponseInfo,
  type UseFullScreenAdStatus,
  type UseInterstitialAdOptions,
  type UseInterstitialAdResult,
  type UseMultiFormatAdResult,
} from '../src';
import { useFullScreenAd } from '../src/hooks/useFullScreenAd';
import { resetWarnOnce } from '../src/internal/warnOnce';

// Importing these from the public barrel fails the build if the fullscreen hook exports
// are dropped. Compile-time narrowing locks live in type-test.ts.
type BarrelCallFormTypesAlive = [
  UseFullScreenAdStatus,
  UseInterstitialAdOptions['adUnitId'],
  UseInterstitialAdResult['status'],
];
const barrelCallFormTypesAlive: BarrelCallFormTypesAlive = ['idle', null, 'idle'];
void barrelCallFormTypesAlive;

type TestAdEventsListener = (event: { type: AdEventType; payload: unknown }) => void;

function createTestInterstitial() {
  let listener: TestAdEventsListener | undefined;
  const unsubscribe = jest.fn();
  const destroy = jest.fn();
  const load = jest.fn();
  const show = jest.fn();
  const ad = {
    addAdEventsListener: jest.fn((nextListener: TestAdEventsListener) => {
      listener = nextListener;
      return unsubscribe;
    }),
    destroy,
    load,
    responseInfo: null,
    show,
  } as unknown as InterstitialAd;

  return {
    ad,
    destroy,
    load,
    show,
    unsubscribe,
    emit(type: AdEventType, payload?: unknown) {
      listener?.({ type, payload });
    },
  };
}

function createResponseInfo(responseId: string): ResponseInfo {
  return {
    responseId,
    adapterClassName: null,
    loadedAdapterResponse: null,
    adapterResponses: [],
    extras: {},
  };
}

function createAdError(
  reason: 'no-fill' | 'network-error',
  responseInfo: ResponseInfo,
): AdError {
  return Object.assign(new Error(reason), {
    code: `googleMobileAds/${reason}`,
    reason,
    phase: 'load' as const,
    responseInfo,
  }) as AdError;
}

describe('fullscreen hook call forms', () => {
  let warn: jest.SpyInstance;

  beforeEach(() => {
    resetWarnOnce();
    warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warn.mockRestore();
    jest.restoreAllMocks();
  });

  it('keeps the positional form on the v16 result shape', () => {
    let result: Record<string, unknown> | null = null;
    function Probe() {
      // eslint-disable-next-line @typescript-eslint/no-deprecated -- exercising the deprecated form on purpose
      result = useInterstitialAd(TestIds.INTERSTITIAL) as unknown as Record<string, unknown>;
      return null;
    }
    render(<Probe />);

    expect(result).not.toBeNull();
    // The legacy booleans are the whole contract here: no `status`, no `retry`.
    expect(result!).toMatchObject({
      isLoaded: false,
      isOpened: false,
      isClicked: false,
      isClosed: false,
      isShowing: false,
      responseInfo: null,
    });
    expect(result!.status).toBeUndefined();
    expect(result!.retry).toBeUndefined();
    expect(typeof result!.load).toBe('function');
    expect(typeof result!.show).toBe('function');
    expect(typeof result!.destroy).toBe('function');
  });

  it('routes a null ad unit through the positional form, not the options form', () => {
    let result: Record<string, unknown> | null = null;
    function Probe() {
      // `typeof x === 'string'` would misroute this: null is a documented value.
      // eslint-disable-next-line @typescript-eslint/no-deprecated -- exercising the deprecated form on purpose
      result = useInterstitialAd(null) as unknown as Record<string, unknown>;
      return null;
    }
    render(<Probe />);

    expect(result!.isLoaded).toBe(false);
    expect(result!.status).toBeUndefined();
  });

  it('returns the status shape for the options form', () => {
    let result: Record<string, unknown> | null = null;
    function Probe() {
      result = useInterstitialAd({
        adUnitId: TestIds.INTERSTITIAL,
        requestOptions: { keywords: ['games'] },
      }) as unknown as Record<string, unknown>;
      return null;
    }
    render(<Probe />);

    expect(result!).toMatchObject({
      // Already 'loading': the options form loads on its own, which is the
      // whole reason the form exists. No consumer effect was involved.
      status: 'loading',
      autoLoad: true,
      error: null,
      clicked: false,
      impression: false,
      revenue: null,
      responseInfo: null,
    });
    // The legacy booleans are gone from this shape, not merely unset.
    expect(result!.isLoaded).toBeUndefined();
    expect(result!.isShowing).toBeUndefined();
    expect(result).not.toHaveProperty('reward');
    expect(result).not.toHaveProperty('earnedReward');
    expect(typeof result!.retry).toBe('function');
  });

  it('includes reward properties only for rewarded options results', () => {
    const rewarded = createTestInterstitial();
    const rewardedInterstitial = createTestInterstitial();
    jest
      .spyOn(RewardedAd, 'createForAdRequest')
      .mockReturnValue(rewarded.ad as unknown as RewardedAd);
    jest
      .spyOn(RewardedInterstitialAd, 'createForAdRequest')
      .mockReturnValue(rewardedInterstitial.ad as unknown as RewardedInterstitialAd);
    let rewardedResult: Record<string, unknown> | null = null;
    let rewardedInterstitialResult: Record<string, unknown> | null = null;

    function Probe() {
      rewardedResult = useRewardedAd({
        adUnitId: TestIds.REWARDED,
        autoLoad: false,
      }) as unknown as Record<string, unknown>;
      rewardedInterstitialResult = useRewardedInterstitialAd({
        adUnitId: TestIds.REWARDED_INTERSTITIAL,
        autoLoad: false,
      }) as unknown as Record<string, unknown>;
      return null;
    }

    render(<Probe />);
    expect(rewardedResult).toHaveProperty('reward', null);
    expect(rewardedResult).toHaveProperty('earnedReward', false);
    expect(rewardedInterstitialResult).toHaveProperty('reward', null);
    expect(rewardedInterstitialResult).toHaveProperty('earnedReward', false);

    act(() =>
      rewarded.emit(RewardedAdEventType.LOADED as unknown as AdEventType, {
        amount: 1,
        type: 'reward',
      }),
    );
    expect(rewardedResult).toMatchObject({
      status: 'loaded',
      reward: { amount: 1, type: 'reward' },
    });
  });

  it('keeps caller-owned imperative ads outside hook teardown', () => {
    const fake = createTestInterstitial();
    let result: ReturnType<typeof useFullScreenAd> | undefined;

    function Probe() {
      result = useFullScreenAd(fake.ad);
      return null;
    }

    const view = render(<Probe />);
    act(() => result!.destroy());
    expect(fake.destroy).toHaveBeenCalledTimes(1);

    view.unmount();
    expect(fake.destroy).toHaveBeenCalledTimes(1);
  });

  it('echoes the resolved autoLoad policy and stays idle without an ad unit', () => {
    let disabled: Record<string, unknown> | null = null;
    let deferred: Record<string, unknown> | null = null;
    function Probe() {
      disabled = useInterstitialAd({
        adUnitId: TestIds.INTERSTITIAL,
        autoLoad: false,
      }) as unknown as Record<string, unknown>;
      deferred = useAppOpenAd({ adUnitId: null }) as unknown as Record<string, unknown>;
      return null;
    }
    render(<Probe />);

    // 'idle' plus the echoed policy, rather than a separate 'disabled' status:
    // status describes the ad; autoLoad describes automatic-load policy.
    expect(disabled!).toMatchObject({ status: 'idle', autoLoad: false });
    expect(deferred!).toMatchObject({ status: 'idle', autoLoad: true });
  });

  it('destroys options-owned ads on identity and request changes', () => {
    const first = createTestInterstitial();
    const second = createTestInterstitial();
    const third = createTestInterstitial();
    const create = jest
      .spyOn(InterstitialAd, 'createForAdRequest')
      .mockReturnValueOnce(first.ad)
      .mockReturnValueOnce(second.ad)
      .mockReturnValueOnce(third.ad);
    let result: UseInterstitialAdResult | undefined;

    function Probe({
      adUnitId,
      keyword,
    }: {
      adUnitId: string | null;
      keyword: string;
    }) {
      result = useInterstitialAd({
        adUnitId,
        requestOptions: { keywords: [keyword] },
        autoLoad: false,
      });
      return null;
    }

    const view = render(<Probe adUnitId={TestIds.INTERSTITIAL} keyword="games" />);
    expect(create).toHaveBeenCalledTimes(1);
    expect(first.destroy).not.toHaveBeenCalled();

    act(() => first.emit(AdEventType.LOADED));
    expect(result!.status).toBe('loaded');

    view.rerender(<Probe adUnitId={null} keyword="games" />);
    expect(first.destroy).toHaveBeenCalledTimes(1);
    expect(first.unsubscribe).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledTimes(1);
    expect(result!.status).toBe('idle');

    view.rerender(<Probe adUnitId={TestIds.INTERSTITIAL_VIDEO} keyword="games" />);
    expect(create).toHaveBeenCalledTimes(2);
    expect(second.destroy).not.toHaveBeenCalled();

    view.rerender(<Probe adUnitId={TestIds.INTERSTITIAL_VIDEO} keyword="sports" />);
    expect(second.destroy).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledTimes(3);

    view.unmount();
    expect(first.destroy).toHaveBeenCalledTimes(1);
    expect(second.destroy).toHaveBeenCalledTimes(1);
    expect(third.destroy).toHaveBeenCalledTimes(1);
  });

  it('allows explicit load and retry while autoLoad is false without reloading a loaded ad', () => {
    const fake = createTestInterstitial();
    jest.spyOn(InterstitialAd, 'createForAdRequest').mockReturnValue(fake.ad);
    let result: UseInterstitialAdResult | undefined;

    function Probe() {
      result = useInterstitialAd({
        adUnitId: TestIds.INTERSTITIAL,
        autoLoad: false,
      });
      return null;
    }

    render(<Probe />);
    expect(fake.load).not.toHaveBeenCalled();

    act(() => result!.load());
    expect(fake.load).toHaveBeenCalledTimes(1);

    act(() => fake.emit(AdEventType.LOADED));
    act(() => result!.retry());
    expect(fake.load).toHaveBeenCalledTimes(1);
    expect(result!.status).toBe('loaded');

    act(() => fake.emit(AdEventType.CLOSED));
    act(() =>
      fake.emit(
        AdEventType.ERROR,
        createAdError('network-error', createResponseInfo('retryable-error')),
      ),
    );
    act(() => result!.retry());
    expect(fake.load).toHaveBeenCalledTimes(2);
  });

  it('copies no-fill and failure response records to the top-level result', () => {
    const fake = createTestInterstitial();
    jest.spyOn(InterstitialAd, 'createForAdRequest').mockReturnValue(fake.ad);
    let result: UseInterstitialAdResult | undefined;

    function Probe() {
      result = useInterstitialAd({
        adUnitId: TestIds.INTERSTITIAL,
        autoLoad: false,
      });
      return null;
    }

    render(<Probe />);
    act(() => result!.load());

    const noFillResponse = createResponseInfo('no-fill-response');
    const noFillError = createAdError('no-fill', noFillResponse);
    act(() => fake.emit(AdEventType.ERROR, noFillError));
    expect(result!).toMatchObject({
      status: 'no-fill',
      error: noFillError,
      responseInfo: noFillResponse,
    });

    act(() => result!.retry());
    const failureResponse = createResponseInfo('failure-response');
    const failure = createAdError('network-error', failureResponse);
    act(() => fake.emit(AdEventType.ERROR, failure));
    expect(result!).toMatchObject({
      status: 'error',
      error: failure,
      responseInfo: failureResponse,
    });
  });

  it('destroys options-form ownership on unmount but preserves positional unmount behavior', () => {
    const optionsAd = createTestInterstitial();
    const positionalAd = createTestInterstitial();
    jest
      .spyOn(InterstitialAd, 'createForAdRequest')
      .mockReturnValueOnce(optionsAd.ad)
      .mockReturnValueOnce(positionalAd.ad);

    function OptionsProbe() {
      useInterstitialAd({ adUnitId: TestIds.INTERSTITIAL, autoLoad: false });
      return null;
    }
    function PositionalProbe() {
      // eslint-disable-next-line @typescript-eslint/no-deprecated -- compatibility behavior
      useInterstitialAd(TestIds.INTERSTITIAL);
      return null;
    }

    const optionsView = render(<OptionsProbe />);
    optionsView.unmount();
    expect(optionsAd.destroy).toHaveBeenCalledTimes(1);

    const positionalView = render(<PositionalProbe />);
    positionalView.unmount();
    expect(positionalAd.destroy).not.toHaveBeenCalled();
  });

  it('keeps options ownership through a non-null transition to the positional form', () => {
    const optionsAd = createTestInterstitial();
    const create = jest
      .spyOn(InterstitialAd, 'createForAdRequest')
      .mockReturnValue(optionsAd.ad);

    function Probe({ optionsForm }: { optionsForm: boolean }) {
      const argument = optionsForm
        ? { adUnitId: TestIds.INTERSTITIAL, autoLoad: false }
        : TestIds.INTERSTITIAL;
      // eslint-disable-next-line @typescript-eslint/no-deprecated -- transition compatibility
      useInterstitialAd(argument as never);
      return null;
    }

    const view = render(<Probe optionsForm />);
    view.rerender(<Probe optionsForm={false} />);

    expect(create).toHaveBeenCalledTimes(1);
    expect(optionsAd.destroy).not.toHaveBeenCalled();

    view.unmount();
    expect(optionsAd.destroy).toHaveBeenCalledTimes(1);
  });

  it('keeps positional ownership through a non-null transition to the options form', () => {
    const positionalAd = createTestInterstitial();
    const optionsAd = createTestInterstitial();
    const create = jest
      .spyOn(InterstitialAd, 'createForAdRequest')
      .mockReturnValueOnce(positionalAd.ad)
      .mockReturnValueOnce(optionsAd.ad);

    function Probe({
      optionsForm,
      adUnitId,
    }: {
      optionsForm: boolean;
      adUnitId: string;
    }) {
      const argument = optionsForm ? { adUnitId, autoLoad: false } : adUnitId;
      // eslint-disable-next-line @typescript-eslint/no-deprecated -- transition compatibility
      useInterstitialAd(argument as never);
      return null;
    }

    const view = render(
      <Probe optionsForm={false} adUnitId={TestIds.INTERSTITIAL} />,
    );
    view.rerender(<Probe optionsForm adUnitId={TestIds.INTERSTITIAL} />);
    expect(create).toHaveBeenCalledTimes(1);
    expect(positionalAd.destroy).not.toHaveBeenCalled();

    view.rerender(<Probe optionsForm adUnitId={TestIds.INTERSTITIAL_VIDEO} />);
    expect(create).toHaveBeenCalledTimes(2);
    expect(positionalAd.destroy).not.toHaveBeenCalled();

    view.unmount();
    expect(positionalAd.destroy).not.toHaveBeenCalled();
    expect(optionsAd.destroy).toHaveBeenCalledTimes(1);
  });

  it('does not destroy an options-owned ad twice after manual destroy', () => {
    const optionsAd = createTestInterstitial();
    jest.spyOn(InterstitialAd, 'createForAdRequest').mockReturnValue(optionsAd.ad);
    let result: UseInterstitialAdResult | undefined;

    function Probe() {
      result = useInterstitialAd({
        adUnitId: TestIds.INTERSTITIAL,
        autoLoad: false,
      });
      return null;
    }

    const view = render(<Probe />);
    act(() => {
      result!.destroy();
      result!.destroy();
    });
    expect(optionsAd.destroy).toHaveBeenCalledTimes(1);

    view.unmount();
    expect(optionsAd.destroy).toHaveBeenCalledTimes(1);
  });

  it('does not destroy a manually destroyed ad again on replacement', () => {
    const first = createTestInterstitial();
    const second = createTestInterstitial();
    jest
      .spyOn(InterstitialAd, 'createForAdRequest')
      .mockReturnValueOnce(first.ad)
      .mockReturnValueOnce(second.ad);
    let result: UseInterstitialAdResult | undefined;

    function Probe({ adUnitId }: { adUnitId: string }) {
      result = useInterstitialAd({ adUnitId, autoLoad: false });
      return null;
    }

    const view = render(<Probe adUnitId={TestIds.INTERSTITIAL} />);
    act(() => result!.destroy());
    view.rerender(<Probe adUnitId={TestIds.INTERSTITIAL_VIDEO} />);

    expect(first.destroy).toHaveBeenCalledTimes(1);
    view.unmount();
    expect(first.destroy).toHaveBeenCalledTimes(1);
    expect(second.destroy).toHaveBeenCalledTimes(1);
  });

  it('keeps fullscreen callbacks stable while sampling replacement ads', () => {
    const first = createTestInterstitial();
    const second = createTestInterstitial();
    jest
      .spyOn(InterstitialAd, 'createForAdRequest')
      .mockReturnValueOnce(first.ad)
      .mockReturnValueOnce(second.ad);
    const snapshots: UseInterstitialAdResult[] = [];

    function Probe({ adUnitId }: { adUnitId: string }) {
      snapshots.push(
        useInterstitialAd({
          adUnitId,
          autoLoad: false,
        }),
      );
      return null;
    }

    const view = render(<Probe adUnitId={TestIds.INTERSTITIAL} />);
    view.rerender(<Probe adUnitId={TestIds.INTERSTITIAL_VIDEO} />);

    const firstResult = snapshots[0]!;
    for (const snapshot of snapshots.slice(1)) {
      expect(snapshot.load).toBe(firstResult.load);
      expect(snapshot.retry).toBe(firstResult.retry);
      expect(snapshot.show).toBe(firstResult.show);
      expect(snapshot.destroy).toBe(firstResult.destroy);
    }

    act(() => firstResult.load());
    expect(first.load).not.toHaveBeenCalled();
    expect(second.load).toHaveBeenCalledTimes(1);

    act(() => firstResult.show());
    expect(first.show).not.toHaveBeenCalled();
    expect(second.show).toHaveBeenCalledTimes(1);

    view.unmount();
  });

  it('issues only one automatic load for the surviving StrictMode instance', () => {
    const instances: ReturnType<typeof createTestInterstitial>[] = [];
    jest.spyOn(InterstitialAd, 'createForAdRequest').mockImplementation(() => {
      const instance = createTestInterstitial();
      instances.push(instance);
      return instance.ad;
    });

    function Probe() {
      useInterstitialAd({ adUnitId: TestIds.INTERSTITIAL });
      return null;
    }

    const view = render(
      <React.StrictMode>
        <Probe />
      </React.StrictMode>,
    );

    expect(instances.reduce((count, instance) => count + instance.load.mock.calls.length, 0)).toBe(
      1,
    );
    expect(instances.filter(instance => instance.destroy.mock.calls.length === 0)).toHaveLength(1);

    view.unmount();
    expect(instances.every(instance => instance.destroy.mock.calls.length === 1)).toBe(true);
  });

  it('keeps hook order stable when the call form changes', () => {
    let result: Record<string, unknown> | null = null;

    function Probe({ optionsForm }: { optionsForm: boolean }) {
      const argument = optionsForm ? { adUnitId: null } : null;
      result = useInterstitialAd(argument as never) as unknown as Record<string, unknown>;
      return null;
    }

    const view = render(<Probe optionsForm={false} />);
    expect(result!.status).toBeUndefined();

    view.rerender(<Probe optionsForm />);
    expect(result!).toMatchObject({ status: 'idle', autoLoad: true });

    view.rerender(<Probe optionsForm={false} />);
    expect(result!.status).toBeUndefined();
  });

  it('warns once for the deprecated positional form, and never for the options form', () => {
    function Positional() {
      // eslint-disable-next-line @typescript-eslint/no-deprecated -- exercising the deprecated form on purpose
      useInterstitialAd(TestIds.INTERSTITIAL);
      return null;
    }
    function Options() {
      useAppOpenAd({ adUnitId: null });
      return null;
    }
    function OtherPositional() {
      // eslint-disable-next-line @typescript-eslint/no-deprecated -- exercising the deprecated form on purpose
      useAppOpenAd(null);
      return null;
    }

    render(<Positional />);
    render(<Positional />);
    render(<OtherPositional />);
    render(<OtherPositional />);
    render(<Options />);

    const deprecations = warn.mock.calls
      .map(call => String(call[0]))
      .filter(message => message.includes('is deprecated'));

    // Keyed per hook, so each deprecated hook warns once even when mounted twice.
    // A hook body runs on every render; an unkeyed warning would be muted noise.
    expect(deprecations).toHaveLength(2);
    expect(
      deprecations.filter(message =>
        message.includes('useInterstitialAd(adUnitId, requestOptions)'),
      ),
    ).toHaveLength(1);
    expect(
      deprecations.filter(message => message.includes('useAppOpenAd(adUnitId, requestOptions)')),
    ).toHaveLength(1);
    expect(deprecations.every(message => message.includes('removed in v18'))).toBe(true);
  });

  it('takes one options object on useMultiFormatAd and reports the response record', async () => {
    let result: UseMultiFormatAdResult | undefined;
    function Probe() {
      result = useMultiFormatAd({
        adUnitId: TestIds.GAM_NATIVE,
        requestOptions: { formats: [AdFormat.NATIVE] },
        autoLoad: false,
      });
      return null;
    }
    render(<Probe />);

    expect(result!).toMatchObject({
      status: 'idle',
      autoLoad: false,
      responseInfo: null,
    });
    expect(typeof result!.retry).toBe('function');

    // A clean no-fill lists no failures but still carries the response record.
    await act(async () => {
      await expect(result!.load()).resolves.toEqual({
        status: 'no-fill',
        ads: [],
        errors: [],
        responseInfo: null,
      });
    });
    expect(result!).toMatchObject({
      status: 'no-fill',
      ads: [],
      errors: [],
      responseInfo: null,
    });

    act(() => {
      expect(result!.release()).toEqual([]);
    });
    expect(result!.status).toBe('idle');
  });

  it('auto-loads useMultiFormatAd and lets retry update rendered state', async () => {
    let result: UseMultiFormatAdResult | undefined;

    function Probe() {
      result = useMultiFormatAd({
        adUnitId: TestIds.GAM_NATIVE,
        requestOptions: { formats: [AdFormat.NATIVE] },
      });
      return null;
    }

    render(<Probe />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(result!.status).toBe('no-fill');

    act(() => result!.retry());
    expect(result!.status).toBe('loading');
    await act(async () => {
      await Promise.resolve();
    });
    expect(result!.status).toBe('no-fill');
  });
});
