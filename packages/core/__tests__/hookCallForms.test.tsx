import React from 'react';
import { act, render } from '@testing-library/react-native';

import {
  AdEventType,
  AdFormat,
  BannerAdSize,
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
  type UseRewardedAdResult,
} from '../src';
import { useFullScreenAd } from '../src/hooks/useFullScreenAd';
import { resetWarnOnce } from '../src/internal/warnOnce';
import NativeGoogleMobileAdsNativeModule from '../src/specs/modules/NativeGoogleMobileAdsNativeModule';
import NativeInterstitialModule from '../src/specs/modules/NativeInterstitialModule';

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
  reason: 'no-fill' | 'mediation-no-fill' | 'network-error',
  responseInfo: ResponseInfo,
  phase: 'load' | 'show' = 'load',
): AdError {
  return Object.assign(new Error(reason), {
    code: `googleMobileAds/${reason}`,
    reason,
    phase,
    responseInfo,
  }) as AdError;
}

type NativeErrorEventBody = {
  code: string;
  message: string;
  phase?: 'load' | 'show';
};

/**
 * Renders children until one of them throws, then renders nothing.
 *
 * Used to abort a render *after* the hook body has run: React discards the
 * whole in-progress render, so nothing that render did in its effects is
 * committed, and the previously committed tree is the one that unmounts.
 */
class RenderAbortBoundary extends React.Component<
  { children: React.ReactNode },
  { aborted: boolean }
> {
  state = { aborted: false };

  static getDerivedStateFromError() {
    return { aborted: true };
  }

  render() {
    return this.state.aborted ? null : this.props.children;
  }
}

/** Throws during render, after earlier siblings and parents have rendered. */
function AbortRender({ abort }: { abort: boolean }) {
  if (abort) {
    throw new Error('aborted before commit');
  }
  return null;
}

function createSuspension() {
  let resolvePromise!: () => void;
  const suspension = {
    pending: true,
    promise: new Promise<void>(resolve => {
      resolvePromise = resolve;
    }),
    resolve() {
      suspension.pending = false;
      resolvePromise();
    },
  };
  return suspension;
}

function SuspendRender({
  suspend,
  suspension,
}: {
  suspend: boolean;
  suspension: ReturnType<typeof createSuspension>;
}) {
  if (suspend && suspension.pending) {
    throw suspension.promise;
  }
  return null;
}

/**
 * Drives real `InterstitialAd` instances, with only the native module mocked,
 * so the show-path guards under test come from `MobileAd.show()` itself rather
 * than from a stub that decides when to throw.
 */
function trackRealInterstitials() {
  const createForAdRequest = InterstitialAd.createForAdRequest.bind(InterstitialAd);
  const created: InterstitialAd[] = [];
  jest
    .spyOn(InterstitialAd, 'createForAdRequest')
    .mockImplementation((...args: Parameters<typeof InterstitialAd.createForAdRequest>) => {
      const ad = createForAdRequest(...args);
      created.push(ad);
      return ad;
    });
  const show = jest.mocked(NativeInterstitialModule.interstitialShow);
  show.mockReset();

  return {
    created,
    show,
    emit(ad: InterstitialAd, type: AdEventType, error?: NativeErrorEventBody) {
      (ad as unknown as { _handleAdEvent: (event: unknown) => void })._handleAdEvent({
        body: { type, error },
      });
    },
  };
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

    function Probe({ adUnitId, keyword }: { adUnitId: string | null; keyword: string }) {
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

  it('classifies load-phase mediation-no-fill as no-fill and keeps show-phase errors as error', () => {
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

    const mediationNoFillResponse = createResponseInfo('mediation-no-fill-response');
    const mediationNoFillError = createAdError('mediation-no-fill', mediationNoFillResponse);
    act(() => fake.emit(AdEventType.ERROR, mediationNoFillError));
    expect(result!).toMatchObject({
      status: 'no-fill',
      error: mediationNoFillError,
      responseInfo: mediationNoFillResponse,
    });

    act(() => result!.retry());
    const showPhaseMediationNoFill = createAdError(
      'mediation-no-fill',
      createResponseInfo('show-mediation-no-fill'),
      'show',
    );
    act(() => fake.emit(AdEventType.ERROR, showPhaseMediationNoFill));
    expect(result!).toMatchObject({
      status: 'error',
      error: showPhaseMediationNoFill,
    });

    act(() => result!.retry());
    const showPhaseNoFill = createAdError(
      'no-fill',
      createResponseInfo('show-no-fill'),
      'show',
    );
    act(() => fake.emit(AdEventType.ERROR, showPhaseNoFill));
    expect(result!).toMatchObject({
      status: 'error',
      error: showPhaseNoFill,
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
    const create = jest.spyOn(InterstitialAd, 'createForAdRequest').mockReturnValue(optionsAd.ad);
    let result: ReturnType<typeof useInterstitialAd> | undefined;

    function Probe({ optionsForm }: { optionsForm: boolean }) {
      const argument = optionsForm
        ? { adUnitId: TestIds.INTERSTITIAL, autoLoad: false }
        : TestIds.INTERSTITIAL;
      // eslint-disable-next-line @typescript-eslint/no-deprecated -- transition compatibility
      result = useInterstitialAd(argument as never);
      return null;
    }

    const view = render(<Probe optionsForm />);
    view.rerender(<Probe optionsForm={false} />);

    expect(create).toHaveBeenCalledTimes(1);
    expect(optionsAd.destroy).not.toHaveBeenCalled();

    act(() => {
      result!.destroy();
      result!.destroy();
    });
    expect(optionsAd.destroy).toHaveBeenCalledTimes(1);
    expect(optionsAd.load).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledTimes(1);

    view.unmount();
    expect(optionsAd.destroy).toHaveBeenCalledTimes(1);
  });

  it('destroys the surviving instance after a positional-to-options transition without destroy', () => {
    const unmountAd = createTestInterstitial();
    const identityFirst = createTestInterstitial();
    const identitySecond = createTestInterstitial();
    const create = jest
      .spyOn(InterstitialAd, 'createForAdRequest')
      .mockReturnValueOnce(unmountAd.ad)
      .mockReturnValueOnce(identityFirst.ad)
      .mockReturnValueOnce(identitySecond.ad);

    function UnmountProbe({ optionsForm }: { optionsForm: boolean }) {
      const argument = optionsForm
        ? { adUnitId: TestIds.INTERSTITIAL, autoLoad: false }
        : TestIds.INTERSTITIAL;
      // eslint-disable-next-line @typescript-eslint/no-deprecated -- transition compatibility
      useInterstitialAd(argument as never);
      return null;
    }

    const unmountView = render(<UnmountProbe optionsForm={false} />);
    unmountView.rerender(<UnmountProbe optionsForm />);
    expect(create).toHaveBeenCalledTimes(1);
    expect(unmountAd.destroy).not.toHaveBeenCalled();
    unmountView.unmount();
    expect(unmountAd.destroy).toHaveBeenCalledTimes(1);
    expect(unmountAd.unsubscribe).toHaveBeenCalledTimes(1);

    function IdentityProbe({
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

    const identityView = render(
      <IdentityProbe optionsForm={false} adUnitId={TestIds.INTERSTITIAL} />,
    );
    identityView.rerender(
      <IdentityProbe optionsForm adUnitId={TestIds.INTERSTITIAL} />,
    );
    expect(create).toHaveBeenCalledTimes(2);
    expect(identityFirst.destroy).not.toHaveBeenCalled();

    identityView.rerender(
      <IdentityProbe optionsForm adUnitId={TestIds.INTERSTITIAL_VIDEO} />,
    );
    expect(create).toHaveBeenCalledTimes(3);
    expect(identityFirst.destroy).toHaveBeenCalledTimes(1);
    expect(identityFirst.unsubscribe).toHaveBeenCalledTimes(1);
    expect(identitySecond.destroy).not.toHaveBeenCalled();

    identityView.unmount();
    expect(identityFirst.destroy).toHaveBeenCalledTimes(1);
    expect(identitySecond.destroy).toHaveBeenCalledTimes(1);
  });

  it('relinquishes options ownership after an options-to-positional transition without destroy', () => {
    const unmountAd = createTestInterstitial();
    const identityFirst = createTestInterstitial();
    const identitySecond = createTestInterstitial();
    const create = jest
      .spyOn(InterstitialAd, 'createForAdRequest')
      .mockReturnValueOnce(unmountAd.ad)
      .mockReturnValueOnce(identityFirst.ad)
      .mockReturnValueOnce(identitySecond.ad);

    function UnmountProbe({ optionsForm }: { optionsForm: boolean }) {
      const argument = optionsForm
        ? { adUnitId: TestIds.INTERSTITIAL, autoLoad: false }
        : TestIds.INTERSTITIAL;
      // eslint-disable-next-line @typescript-eslint/no-deprecated -- transition compatibility
      useInterstitialAd(argument as never);
      return null;
    }

    const unmountView = render(<UnmountProbe optionsForm />);
    unmountView.rerender(<UnmountProbe optionsForm={false} />);
    expect(create).toHaveBeenCalledTimes(1);
    expect(unmountAd.destroy).not.toHaveBeenCalled();
    unmountView.unmount();
    expect(unmountAd.destroy).not.toHaveBeenCalled();
    expect(unmountAd.unsubscribe).toHaveBeenCalledTimes(1);

    function IdentityProbe({
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

    const identityView = render(
      <IdentityProbe optionsForm adUnitId={TestIds.INTERSTITIAL} />,
    );
    identityView.rerender(
      <IdentityProbe optionsForm={false} adUnitId={TestIds.INTERSTITIAL} />,
    );
    expect(create).toHaveBeenCalledTimes(2);
    expect(identityFirst.destroy).not.toHaveBeenCalled();

    identityView.rerender(
      <IdentityProbe optionsForm={false} adUnitId={TestIds.INTERSTITIAL_VIDEO} />,
    );
    expect(create).toHaveBeenCalledTimes(3);
    expect(identityFirst.destroy).not.toHaveBeenCalled();
    expect(identityFirst.unsubscribe).toHaveBeenCalledTimes(1);
    expect(identitySecond.destroy).not.toHaveBeenCalled();

    identityView.unmount();
    expect(identityFirst.destroy).not.toHaveBeenCalled();
    expect(identitySecond.destroy).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: 'positional to options',
      startsWithOptions: false,
      expectedDestroyCalls: 0,
    },
    {
      name: 'options to positional',
      startsWithOptions: true,
      expectedDestroyCalls: 1,
    },
  ])(
    'keeps committed ownership when an aborted $name render is discarded',
    ({ startsWithOptions, expectedDestroyCalls }) => {
      const committedAd = createTestInterstitial();
      const create = jest
        .spyOn(InterstitialAd, 'createForAdRequest')
        .mockReturnValue(committedAd.ad);
      const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);

      function Probe({ optionsForm, abort }: { optionsForm: boolean; abort: boolean }) {
        const argument = optionsForm
          ? { adUnitId: TestIds.INTERSTITIAL, autoLoad: false }
          : TestIds.INTERSTITIAL;
        // eslint-disable-next-line @typescript-eslint/no-deprecated -- transition compatibility
        useInterstitialAd(argument as never);
        return <AbortRender abort={abort} />;
      }

      try {
        const view = render(
          <RenderAbortBoundary>
            <Probe optionsForm={startsWithOptions} abort={false} />
          </RenderAbortBoundary>,
        );
        expect(create).toHaveBeenCalledTimes(1);
        expect(committedAd.destroy).not.toHaveBeenCalled();

        // The hook body runs with the other call form, then a child throws, so
        // this render is thrown away and the committed tree unmounts instead.
        view.rerender(
          <RenderAbortBoundary>
            <Probe optionsForm={!startsWithOptions} abort />
          </RenderAbortBoundary>,
        );

        expect(create).toHaveBeenCalledTimes(1);
        expect(committedAd.unsubscribe).toHaveBeenCalledTimes(1);
        expect(committedAd.destroy).toHaveBeenCalledTimes(expectedDestroyCalls);

        view.unmount();
        expect(committedAd.destroy).toHaveBeenCalledTimes(expectedDestroyCalls);
      } finally {
        error.mockRestore();
      }
    },
  );

  it.each([
    { name: 'options', optionsForm: true, expectedUnmountDestroyCalls: 1 },
    { name: 'positional', optionsForm: false, expectedUnmountDestroyCalls: 0 },
  ])(
    'makes saved $name callbacks no-op after unmount',
    ({ optionsForm, expectedUnmountDestroyCalls }) => {
      const current = createTestInterstitial();
      const create = jest.spyOn(InterstitialAd, 'createForAdRequest').mockReturnValue(current.ad);
      let result: Record<string, unknown> | undefined;
      let renders = 0;

      function Probe() {
        renders += 1;
        const argument = optionsForm
          ? { adUnitId: TestIds.INTERSTITIAL, autoLoad: false }
          : TestIds.INTERSTITIAL;
        // eslint-disable-next-line @typescript-eslint/no-deprecated -- transition compatibility
        result = useInterstitialAd(argument as never) as unknown as Record<string, unknown>;
        return null;
      }

      const view = render(<Probe />);
      const saved = {
        destroy: result!.destroy as () => void,
        load: result!.load as () => void,
        retry: result!.retry as (() => void) | undefined,
        show: result!.show as () => void,
      };
      const committedState = optionsForm ? result!.status : result!.isLoaded;
      view.unmount();

      expect(current.unsubscribe).toHaveBeenCalledTimes(1);
      expect(current.destroy).toHaveBeenCalledTimes(expectedUnmountDestroyCalls);
      const rendersAtUnmount = renders;
      act(() => {
        saved.load();
        saved.retry?.();
        saved.show();
        saved.destroy();
        current.emit(AdEventType.LOADED);
      });

      expect(create).toHaveBeenCalledTimes(1);
      expect(current.load).not.toHaveBeenCalled();
      expect(current.show).not.toHaveBeenCalled();
      expect(current.destroy).toHaveBeenCalledTimes(expectedUnmountDestroyCalls);
      expect(renders).toBe(rendersAtUnmount);
      expect(optionsForm ? result!.status : result!.isLoaded).toBe(committedState);
    },
  );

  it('uses committed positional form while an options render is suspended', async () => {
    const committed = createTestInterstitial();
    const unusedReplacement = createTestInterstitial();
    const create = jest
      .spyOn(InterstitialAd, 'createForAdRequest')
      .mockReturnValueOnce(committed.ad)
      .mockReturnValueOnce(unusedReplacement.ad);
    const suspension = createSuspension();
    let result: ReturnType<typeof useInterstitialAd> | undefined;

    function Probe({ optionsForm, suspend }: { optionsForm: boolean; suspend: boolean }) {
      const argument = optionsForm
        ? {
            adUnitId: TestIds.INTERSTITIAL_VIDEO,
            requestOptions: { keywords: ['discarded'] },
            autoLoad: false,
          }
        : TestIds.INTERSTITIAL;
      // eslint-disable-next-line @typescript-eslint/no-deprecated -- transition compatibility
      result = useInterstitialAd(argument as never);
      return <SuspendRender suspend={suspend} suspension={suspension} />;
    }

    const view = render(
      <React.Suspense fallback={null}>
        <Probe optionsForm={false} suspend={false} />
      </React.Suspense>,
    );
    const destroy = result!.destroy;

    act(() => {
      React.startTransition(() => {
        view.rerender(
          <React.Suspense fallback={null}>
            <Probe optionsForm suspend />
          </React.Suspense>,
        );
      });
    });
    expect(create).toHaveBeenCalledTimes(1);
    expect(committed.unsubscribe).not.toHaveBeenCalled();
    expect(committed.destroy).not.toHaveBeenCalled();

    act(() => {
      destroy();
      // Unmount in the same batch to discard the still-suspended transition,
      // after the callback has run against the mounted committed tree.
      view.unmount();
    });
    expect(committed.destroy).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledTimes(1);
    expect(unusedReplacement.load).not.toHaveBeenCalled();

    await act(async () => {
      suspension.resolve();
      await suspension.promise;
    });
  });

  it('uses committed options args and autoLoad while a changed render is suspended', async () => {
    const committed = createTestInterstitial();
    const replacement = createTestInterstitial();
    const unused = createTestInterstitial();
    const create = jest
      .spyOn(InterstitialAd, 'createForAdRequest')
      .mockReturnValueOnce(committed.ad)
      .mockReturnValueOnce(replacement.ad)
      .mockReturnValueOnce(unused.ad);
    const suspension = createSuspension();
    let result: UseInterstitialAdResult | undefined;

    function Probe({
      suspend,
      adUnitId,
      keyword,
      autoLoad,
    }: {
      suspend: boolean;
      adUnitId: string;
      keyword: string;
      autoLoad: boolean;
    }) {
      result = useInterstitialAd({
        adUnitId,
        requestOptions: { keywords: [keyword] },
        autoLoad,
      });
      return <SuspendRender suspend={suspend} suspension={suspension} />;
    }

    const view = render(
      <React.Suspense fallback={null}>
        <Probe
          suspend={false}
          adUnitId={TestIds.INTERSTITIAL}
          keyword="games"
          autoLoad
        />
      </React.Suspense>,
    );
    expect(committed.load).toHaveBeenCalledTimes(1);
    const destroy = result!.destroy;

    act(() => {
      React.startTransition(() => {
        view.rerender(
          <React.Suspense fallback={null}>
            <Probe
              suspend
              adUnitId={TestIds.INTERSTITIAL_VIDEO}
              keyword="discarded"
              autoLoad={false}
            />
          </React.Suspense>,
        );
      });
    });
    expect(create).toHaveBeenCalledTimes(1);
    expect(committed.unsubscribe).not.toHaveBeenCalled();

    act(() => {
      destroy();
      view.unmount();
    });
    expect(create).toHaveBeenCalledTimes(2);
    expect(create).toHaveBeenLastCalledWith(TestIds.INTERSTITIAL, {
      keywords: ['games'],
    });
    expect(replacement.load).not.toHaveBeenCalled();
    expect(replacement.destroy).toHaveBeenCalledTimes(1);
    expect(unused.load).not.toHaveBeenCalled();

    await act(async () => {
      suspension.resolve();
      await suspension.promise;
    });
  });

  it('destroy after a committed options-argument change recreates from the new values', () => {
    const first = createTestInterstitial();
    const second = createTestInterstitial();
    const replacement = createTestInterstitial();
    const create = jest
      .spyOn(InterstitialAd, 'createForAdRequest')
      .mockReturnValueOnce(first.ad)
      .mockReturnValueOnce(second.ad)
      .mockReturnValueOnce(replacement.ad);
    let result: UseInterstitialAdResult | undefined;

    function Probe({
      adUnitId,
      keyword,
      autoLoad,
    }: {
      adUnitId: string;
      keyword: string;
      autoLoad: boolean;
    }) {
      result = useInterstitialAd({
        adUnitId,
        requestOptions: { keywords: [keyword] },
        autoLoad,
      });
      return null;
    }

    const view = render(
      <Probe adUnitId={TestIds.INTERSTITIAL} keyword="games" autoLoad />,
    );
    expect(first.load).toHaveBeenCalledTimes(1);

    view.rerender(
      <Probe adUnitId={TestIds.INTERSTITIAL_VIDEO} keyword="sports" autoLoad={false} />,
    );
    expect(create).toHaveBeenCalledTimes(2);
    expect(first.destroy).toHaveBeenCalledTimes(1);

    act(() => result!.destroy());
    expect(create).toHaveBeenCalledTimes(3);
    expect(create).toHaveBeenLastCalledWith(TestIds.INTERSTITIAL_VIDEO, {
      keywords: ['sports'],
    });
    expect(replacement.load).not.toHaveBeenCalled();
  });

  it.each([
    { name: 'positional to options', startsWithOptions: false, outgoingDestroyed: true },
    { name: 'options to positional', startsWithOptions: true, outgoingDestroyed: false },
  ])(
    'cleans the outgoing ad by the incoming committed form on a same-commit $name identity change',
    ({ startsWithOptions, outgoingDestroyed }) => {
      const outgoing = createTestInterstitial();
      const incoming = createTestInterstitial();
      const create = jest
        .spyOn(InterstitialAd, 'createForAdRequest')
        .mockReturnValueOnce(outgoing.ad)
        .mockReturnValueOnce(incoming.ad);

      function Probe({ optionsForm, adUnitId }: { optionsForm: boolean; adUnitId: string }) {
        const argument = optionsForm ? { adUnitId, autoLoad: false } : adUnitId;
        // eslint-disable-next-line @typescript-eslint/no-deprecated -- transition compatibility
        useInterstitialAd(argument as never);
        return null;
      }

      const view = render(
        <Probe optionsForm={startsWithOptions} adUnitId={TestIds.INTERSTITIAL} />,
      );
      expect(create).toHaveBeenCalledTimes(1);

      // One commit changes the call form and the identity together.
      view.rerender(
        <Probe optionsForm={!startsWithOptions} adUnitId={TestIds.INTERSTITIAL_VIDEO} />,
      );
      expect(create).toHaveBeenCalledTimes(2);
      expect(outgoing.unsubscribe).toHaveBeenCalledTimes(1);
      expect(outgoing.destroy).toHaveBeenCalledTimes(outgoingDestroyed ? 1 : 0);
      expect(incoming.destroy).not.toHaveBeenCalled();

      view.unmount();
      expect(outgoing.destroy).toHaveBeenCalledTimes(outgoingDestroyed ? 1 : 0);
      expect(incoming.destroy).toHaveBeenCalledTimes(outgoingDestroyed ? 1 : 0);
    },
  );

  it('makes current options behavior authoritative after a positional transition', () => {
    const positionalAd = createTestInterstitial();
    const replacement = createTestInterstitial();
    const create = jest
      .spyOn(InterstitialAd, 'createForAdRequest')
      .mockReturnValueOnce(positionalAd.ad)
      .mockReturnValueOnce(replacement.ad);
    let result: ReturnType<typeof useInterstitialAd> | undefined;

    function Probe({ optionsForm }: { optionsForm: boolean }) {
      const argument = optionsForm
        ? { adUnitId: TestIds.INTERSTITIAL }
        : TestIds.INTERSTITIAL;
      // eslint-disable-next-line @typescript-eslint/no-deprecated -- transition compatibility
      result = useInterstitialAd(argument as never);
      return null;
    }

    const view = render(<Probe optionsForm={false} />);
    act(() => positionalAd.emit(AdEventType.LOADED));
    view.rerender(<Probe optionsForm />);
    expect(create).toHaveBeenCalledTimes(1);
    expect(positionalAd.destroy).not.toHaveBeenCalled();

    act(() => result!.destroy());
    expect(positionalAd.destroy).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ status: 'idle', autoLoad: true, error: null });
    expect(replacement.load).not.toHaveBeenCalled();

    act(() => result!.load());
    expect(replacement.load).toHaveBeenCalledTimes(1);
    act(() =>
      replacement.emit(
        AdEventType.ERROR,
        createAdError('network-error', createResponseInfo('transition-retry')),
      ),
    );
    act(() => (result as UseInterstitialAdResult).retry());
    expect(replacement.load).toHaveBeenCalledTimes(2);

    view.unmount();
    expect(positionalAd.destroy).toHaveBeenCalledTimes(1);
    expect(replacement.destroy).toHaveBeenCalledTimes(1);
  });

  it('recreates an idle options-owned ad after destroy and loads the replacement', () => {
    const first = createTestInterstitial();
    const replacement = createTestInterstitial();
    const create = jest
      .spyOn(InterstitialAd, 'createForAdRequest')
      .mockReturnValueOnce(first.ad)
      .mockReturnValueOnce(replacement.ad);
    let result: UseInterstitialAdResult | undefined;

    function Probe() {
      result = useInterstitialAd({
        adUnitId: TestIds.INTERSTITIAL,
        requestOptions: { keywords: ['games'] },
        autoLoad: false,
      });
      return null;
    }

    render(<Probe />);
    const callbacks = {
      load: result!.load,
      retry: result!.retry,
      show: result!.show,
      destroy: result!.destroy,
    };
    act(() => first.emit(AdEventType.LOADED));
    expect(result!.status).toBe('loaded');

    act(() => result!.destroy());
    expect(first.destroy).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledTimes(2);
    expect(create).toHaveBeenNthCalledWith(2, TestIds.INTERSTITIAL, {
      keywords: ['games'],
    });
    expect(result!.status).toBe('idle');
    expect(replacement.load).not.toHaveBeenCalled();
    expect(result!.load).toBe(callbacks.load);
    expect(result!.retry).toBe(callbacks.retry);
    expect(result!.show).toBe(callbacks.show);
    expect(result!.destroy).toBe(callbacks.destroy);

    act(() => result!.load());
    expect(first.load).not.toHaveBeenCalled();
    expect(replacement.load).toHaveBeenCalledTimes(1);

    act(() =>
      replacement.emit(
        AdEventType.ERROR,
        createAdError('network-error', createResponseInfo('replacement-retry')),
      ),
    );
    act(() => result!.retry());
    expect(replacement.load).toHaveBeenCalledTimes(2);
  });

  it('does not auto-load a replacement after destroy in StrictMode', () => {
    const instances: ReturnType<typeof createTestInterstitial>[] = [];
    jest.spyOn(InterstitialAd, 'createForAdRequest').mockImplementation(() => {
      const instance = createTestInterstitial();
      instances.push(instance);
      return instance.ad;
    });
    let result: UseInterstitialAdResult | undefined;

    function Probe() {
      result = useInterstitialAd({ adUnitId: TestIds.INTERSTITIAL });
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

    const beforeDestroy = instances.find(instance => instance.destroy.mock.calls.length === 0)!;
    act(() => result!.destroy());
    const replacement = instances.at(-1)!;
    expect(beforeDestroy.destroy).toHaveBeenCalledTimes(1);
    expect(result!.status).toBe('idle');
    expect(replacement.load).not.toHaveBeenCalled();

    act(() => result!.retry());
    expect(replacement.load).toHaveBeenCalledTimes(1);

    view.unmount();
    expect(instances.every(instance => instance.destroy.mock.calls.length === 1)).toBe(true);
  });

  it('ignores stale in-flight events after destroy', () => {
    const first = createTestInterstitial();
    const replacement = createTestInterstitial();
    jest
      .spyOn(InterstitialAd, 'createForAdRequest')
      .mockReturnValueOnce(first.ad)
      .mockReturnValueOnce(replacement.ad);
    let result: UseInterstitialAdResult | undefined;

    function Probe() {
      result = useInterstitialAd({ adUnitId: TestIds.INTERSTITIAL, autoLoad: false });
      return null;
    }

    render(<Probe />);
    act(() => result!.load());
    expect(result!.status).toBe('loading');

    act(() => result!.destroy());
    expect(result!.status).toBe('idle');
    expect(first.unsubscribe).toHaveBeenCalledTimes(1);

    act(() => first.emit(AdEventType.LOADED));
    act(() =>
      first.emit(
        AdEventType.ERROR,
        createAdError('network-error', createResponseInfo('retired-error')),
      ),
    );
    expect(result!).toMatchObject({ status: 'idle', error: null });

    act(() => result!.load());
    act(() => replacement.emit(AdEventType.LOADED));
    expect(result!.status).toBe('loaded');
  });

  it('resets a closed rewarded ad and its accumulated fields on destroy', () => {
    const first = createTestInterstitial();
    const replacement = createTestInterstitial();
    jest
      .spyOn(RewardedAd, 'createForAdRequest')
      .mockReturnValueOnce(first.ad as unknown as RewardedAd)
      .mockReturnValueOnce(replacement.ad as unknown as RewardedAd);
    let result: UseRewardedAdResult | undefined;

    function Probe() {
      result = useRewardedAd({ adUnitId: TestIds.REWARDED, autoLoad: false });
      return null;
    }

    render(<Probe />);
    const reward = { amount: 1, type: 'coin' };
    act(() => first.emit(RewardedAdEventType.LOADED as unknown as AdEventType, reward));
    act(() => first.emit(AdEventType.CLICKED));
    act(() => first.emit(AdEventType.IMPRESSION));
    act(() => first.emit(AdEventType.PAID, { value: 7 }));
    act(() =>
      first.emit(RewardedAdEventType.EARNED_REWARD as unknown as AdEventType, reward),
    );
    const responseInfo = createResponseInfo('closed-response');
    const showError = createAdError('network-error', responseInfo, 'show');
    act(() => first.emit(AdEventType.ERROR, showError));
    expect(result).toMatchObject({ status: 'error', error: showError, responseInfo });
    act(() => first.emit(AdEventType.CLOSED));
    expect(result).toMatchObject({
      status: 'closed',
      error: null,
      clicked: true,
      impression: true,
      revenue: { value: 7 },
      responseInfo,
      reward,
      earnedReward: true,
    });

    act(() => result!.destroy());
    expect(first.destroy).toHaveBeenCalledTimes(1);
    expect(replacement.load).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      status: 'idle',
      error: null,
      clicked: false,
      impression: false,
      revenue: null,
      responseInfo: null,
      reward: null,
      earnedReward: false,
    });
  });

  it('recreates on repeated options destroy and destroys every instance once', () => {
    const first = createTestInterstitial();
    const second = createTestInterstitial();
    const third = createTestInterstitial();
    jest
      .spyOn(InterstitialAd, 'createForAdRequest')
      .mockReturnValueOnce(first.ad)
      .mockReturnValueOnce(second.ad)
      .mockReturnValueOnce(third.ad);
    let result: UseInterstitialAdResult | undefined;

    function Probe() {
      result = useInterstitialAd({ adUnitId: TestIds.INTERSTITIAL, autoLoad: false });
      return null;
    }

    const view = render(<Probe />);
    act(() => result!.destroy());
    act(() => result!.destroy());

    expect(first.destroy).toHaveBeenCalledTimes(1);
    expect(second.destroy).toHaveBeenCalledTimes(1);
    expect(third.destroy).not.toHaveBeenCalled();
    expect(result!.status).toBe('idle');

    view.unmount();
    expect(third.destroy).toHaveBeenCalledTimes(1);
  });

  it('keeps options destroy idle when the current ad unit is null', () => {
    const create = jest.spyOn(InterstitialAd, 'createForAdRequest');
    let result: UseInterstitialAdResult | undefined;

    function Probe() {
      result = useInterstitialAd({ adUnitId: null });
      return null;
    }

    render(<Probe />);
    act(() => result!.destroy());
    expect(create).not.toHaveBeenCalled();
    expect(result!.status).toBe('idle');
  });

  it('keeps positional destroy behavior unchanged', () => {
    const positional = createTestInterstitial();
    const create = jest.spyOn(InterstitialAd, 'createForAdRequest').mockReturnValue(positional.ad);
    let result: ReturnType<typeof useInterstitialAd> | undefined;

    function Probe() {
      // eslint-disable-next-line @typescript-eslint/no-deprecated -- compatibility behavior
      result = useInterstitialAd(TestIds.INTERSTITIAL);
      return null;
    }

    render(<Probe />);
    act(() => result!.destroy());
    expect(positional.destroy).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledTimes(1);
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

  it('keeps an unshowable show() a silent no-op instead of throwing at the press', () => {
    const interstitials = trackRealInterstitials();
    let loadedNothing: UseInterstitialAdResult | undefined;
    let withoutAnAd: Record<string, unknown> | null = null;

    function Probe() {
      loadedNothing = useInterstitialAd({ adUnitId: TestIds.INTERSTITIAL, autoLoad: false });
      withoutAnAd = useAppOpenAd({ adUnitId: null }) as unknown as Record<string, unknown>;
      return null;
    }
    render(<Probe />);

    // `MobileAd.show()` throws "has not loaded" here. `show` is written at
    // `onPress`, so the press has to survive it, and nothing native runs.
    expect(() => act(() => loadedNothing!.show())).not.toThrow();
    expect(interstitials.show).not.toHaveBeenCalled();
    expect(loadedNothing!).toMatchObject({ status: 'idle', error: null });

    // No ad instance at all: same silence, and still no invented error.
    expect(() => act(() => (withoutAnAd!.show as () => void)())).not.toThrow();
    expect(withoutAnAd!).toMatchObject({ status: 'idle', error: null });
  });

  it('shows a loaded ad once and absorbs a repeated press before it opens', () => {
    const interstitials = trackRealInterstitials();
    let result: UseInterstitialAdResult | undefined;

    function Probe() {
      result = useInterstitialAd({ adUnitId: TestIds.INTERSTITIAL, autoLoad: false });
      return null;
    }
    render(<Probe />);
    const ad = interstitials.created[0]!;

    act(() => interstitials.emit(ad, AdEventType.LOADED));
    expect(result!.status).toBe('loaded');

    act(() => result!.show({ immersiveModeEnabled: true }));
    expect(interstitials.show).toHaveBeenCalledTimes(1);
    expect(interstitials.show.mock.calls[0]![2]).toEqual({ immersiveModeEnabled: true });
    // `'showing'` stays event-driven: the call itself moves no status.
    expect(result!.status).toBe('loaded');

    // A second press before OPENED throws "Show has already been requested".
    expect(() => act(() => result!.show())).not.toThrow();
    expect(interstitials.show).toHaveBeenCalledTimes(1);
    expect(result!).toMatchObject({ status: 'loaded', error: null });

    act(() => interstitials.emit(ad, AdEventType.OPENED));
    expect(result!.status).toBe('showing');
  });

  it('consumes a rejected show promise rather than leaking an unhandled rejection', async () => {
    const interstitials = trackRealInterstitials();
    interstitials.show.mockImplementationOnce(() => Promise.reject(new Error('show declined')));
    const unhandled: unknown[] = [];
    const recordUnhandled = (reason: unknown) => {
      unhandled.push(reason);
    };
    process.on('unhandledRejection', recordUnhandled);

    let result: UseInterstitialAdResult | undefined;
    function Probe() {
      result = useInterstitialAd({ adUnitId: TestIds.INTERSTITIAL, autoLoad: false });
      return null;
    }

    try {
      render(<Probe />);
      const ad = interstitials.created[0]!;
      act(() => interstitials.emit(ad, AdEventType.LOADED));

      act(() => result!.show());
      await act(async () => {
        await new Promise(resolve => setImmediate(resolve));
      });
      expect(unhandled).toEqual([]);

      // The rejection alone invents no status; the ERROR event is the one that
      // reports a show failure.
      expect(result!).toMatchObject({ status: 'loaded', error: null });
      act(() =>
        interstitials.emit(ad, AdEventType.ERROR, {
          code: 'internal-error',
          message: 'Show failed.',
          phase: 'show',
        }),
      );
      expect(result!.status).toBe('error');
      expect(result!.error?.phase).toBe('show');
    } finally {
      process.off('unhandledRejection', recordUnhandled);
    }
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

  it('never renders useMultiFormatAd loading with the handles that load destroyed', async () => {
    function bannerWinner(handleId: string) {
      return {
        format: 'banner' as const,
        handleId,
        width: 320,
        height: 50,
        responseInfo: null,
        error: null,
      };
    }

    let resolveSecondLoad: (value: ReturnType<typeof bannerWinner>) => void = () => undefined;
    jest
      .mocked(NativeGoogleMobileAdsNativeModule.loadMultiFormat)
      .mockResolvedValueOnce(bannerWinner('h-first'))
      .mockImplementationOnce(
        () =>
          new Promise(resolve => {
            resolveSecondLoad = resolve;
          }),
      );

    const rendered: Array<{ status: string; ads: number }> = [];
    let result: UseMultiFormatAdResult | undefined;
    function Probe() {
      result = useMultiFormatAd({
        adUnitId: TestIds.GAM_NATIVE,
        requestOptions: {
          formats: [AdFormat.BANNER],
          bannerSizes: [BannerAdSize.BANNER],
          adServer: 'ad-manager',
        },
        autoLoad: false,
      });
      rendered.push({ status: result.status, ads: result.ads.length });
      return null;
    }
    render(<Probe />);

    await act(async () => {
      await result!.load();
    });
    expect(result!.status).toBe('loaded');
    expect(result!.ads).toHaveLength(1);
    const destroyFirst = jest.spyOn(result!.ads[0], 'destroy');

    let pending: Promise<unknown> | undefined;
    act(() => {
      pending = result!.load();
    });

    // The paint that announces 'loading' is the one that could hand a consumer
    // a destroyed handle, so assert on what rendered, not just the final state.
    expect(destroyFirst).toHaveBeenCalledTimes(1);
    expect(rendered[rendered.length - 1]).toEqual({ status: 'loading', ads: 0 });
    expect(result!.status).toBe('loading');
    expect(result!.ads).toEqual([]);
    expect(result!.errors).toEqual([]);

    await act(async () => {
      resolveSecondLoad(bannerWinner('h-second'));
      await pending;
    });
    expect(result!.status).toBe('loaded');
    expect(result!.ads).toHaveLength(1);

    act(() => {
      result!.release().forEach(handle => handle.destroy());
    });
  });
});
