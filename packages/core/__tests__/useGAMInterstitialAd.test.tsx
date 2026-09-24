import React from 'react';
import { act, render } from '@testing-library/react-native';

import {
  AdEventType,
  GAMAdEventType,
  GAMInterstitialAd,
  TestIds,
  useGAMInterstitialAd,
  type AppEvent,
  type UseGAMInterstitialAdResult,
} from '../src';

type TestAdEventsListener = (event: {
  type: AdEventType | GAMAdEventType;
  payload: unknown;
}) => void;

function createTestGAMInterstitial() {
  let eventsListener: TestAdEventsListener | undefined;
  let appEventListener: ((event: AppEvent) => void) | undefined;
  const unsubscribe = jest.fn();
  const unsubscribeAppEvent = jest.fn();
  const destroy = jest.fn();
  const load = jest.fn();
  const show = jest.fn();
  const ad = {
    addAdEventsListener: jest.fn((nextListener: TestAdEventsListener) => {
      eventsListener = nextListener;
      return unsubscribe;
    }),
    addAdEventListener: jest.fn(
      (type: AdEventType | GAMAdEventType, listener: (payload: unknown) => void) => {
        if (type === GAMAdEventType.APP_EVENT) {
          appEventListener = listener as (event: AppEvent) => void;
          return unsubscribeAppEvent;
        }
        return jest.fn();
      },
    ),
    destroy,
    load,
    responseInfo: null,
    show,
  } as unknown as GAMInterstitialAd;

  return {
    ad,
    destroy,
    load,
    show,
    unsubscribe,
    emit(type: AdEventType, payload?: unknown) {
      eventsListener?.({ type, payload });
    },
    emitAppEvent(event: AppEvent) {
      appEventListener?.(event);
    },
  };
}

describe('useGAMInterstitialAd', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns the options-form status shape and auto-loads', () => {
    const fake = createTestGAMInterstitial();
    jest.spyOn(GAMInterstitialAd, 'createForAdRequest').mockReturnValue(fake.ad);
    let result: UseGAMInterstitialAdResult | undefined;

    function Probe() {
      result = useGAMInterstitialAd({
        adUnitId: TestIds.GAM_INTERSTITIAL,
        requestOptions: { keywords: ['games'] },
      });
      return null;
    }

    render(<Probe />);

    expect(GAMInterstitialAd.createForAdRequest).toHaveBeenCalledWith(TestIds.GAM_INTERSTITIAL, {
      keywords: ['games'],
    });
    expect(result).toMatchObject({
      status: 'loading',
      autoLoad: true,
      error: null,
      clicked: false,
      impression: false,
      revenue: null,
      responseInfo: null,
    });
    expect(result).not.toHaveProperty('reward');
    expect(result).not.toHaveProperty('earnedReward');
    expect(fake.load).toHaveBeenCalledTimes(1);
  });

  it('tracks load and show lifecycle like useInterstitialAd', () => {
    const fake = createTestGAMInterstitial();
    jest.spyOn(GAMInterstitialAd, 'createForAdRequest').mockReturnValue(fake.ad);
    let result: UseGAMInterstitialAdResult | undefined;

    function Probe() {
      result = useGAMInterstitialAd({
        adUnitId: TestIds.GAM_INTERSTITIAL,
        autoLoad: false,
      });
      return null;
    }

    render(<Probe />);
    expect(result!.status).toBe('idle');
    expect(fake.load).not.toHaveBeenCalled();

    act(() => result!.load());
    expect(result!.status).toBe('loading');
    expect(fake.load).toHaveBeenCalledTimes(1);

    act(() => fake.emit(AdEventType.LOADED));
    expect(result!.status).toBe('loaded');

    act(() => result!.show());
    expect(fake.show).toHaveBeenCalledTimes(1);

    act(() => fake.emit(AdEventType.OPENED));
    expect(result!.status).toBe('showing');

    act(() => fake.emit(AdEventType.CLOSED));
    expect(result!.status).toBe('closed');
  });

  it('does not throw on StrictMode remount', () => {
    const instances: ReturnType<typeof createTestGAMInterstitial>[] = [];
    jest.spyOn(GAMInterstitialAd, 'createForAdRequest').mockImplementation(() => {
      const instance = createTestGAMInterstitial();
      instances.push(instance);
      return instance.ad;
    });

    function Probe() {
      useGAMInterstitialAd({ adUnitId: TestIds.GAM_INTERSTITIAL });
      return null;
    }

    expect(() => {
      const view = render(
        <React.StrictMode>
          <Probe />
        </React.StrictMode>,
      );
      view.unmount();
    }).not.toThrow();

    expect(instances.reduce((count, instance) => count + instance.load.mock.calls.length, 0)).toBe(
      1,
    );
    expect(instances.every(instance => instance.destroy.mock.calls.length === 1)).toBe(true);
  });

  it('fires onAppEvent with name and data without putting them in state', () => {
    const fake = createTestGAMInterstitial();
    jest.spyOn(GAMInterstitialAd, 'createForAdRequest').mockReturnValue(fake.ad);
    const onAppEvent = jest.fn();
    let result: UseGAMInterstitialAdResult | undefined;

    function Probe({ handler }: { handler: typeof onAppEvent }) {
      result = useGAMInterstitialAd({
        adUnitId: TestIds.GAM_INTERSTITIAL,
        autoLoad: false,
        onAppEvent: handler,
      });
      return null;
    }

    const view = render(<Probe handler={onAppEvent} />);
    act(() => fake.emitAppEvent({ name: 'color', data: '#FF0000' }));
    expect(onAppEvent).toHaveBeenCalledWith({ name: 'color', data: '#FF0000' });
    expect(result).toMatchObject({
      status: 'idle',
      clicked: false,
      impression: false,
      revenue: null,
    });

    const nextHandler = jest.fn();
    view.rerender(<Probe handler={nextHandler} />);
    act(() => fake.emitAppEvent({ name: 'action' }));
    expect(nextHandler).toHaveBeenCalledWith({ name: 'action' });
    expect(onAppEvent).toHaveBeenCalledTimes(1);
  });
});
