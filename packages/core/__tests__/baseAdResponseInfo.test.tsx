import React from 'react';
import { act, render } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { BannerAd, BannerAdSize, GAMBannerAdSize } from '../src';
import { RevenuePrecisions } from '../src/common/constants';

const MOCK_ID = 'ca-app-pub-test/banner';

let lastNativeProps: {
  onNativeEvent?: (event: { nativeEvent: Record<string, unknown> }) => void;
} = {};

jest.mock('../src/specs/components/GoogleMobileAdsBannerViewNativeComponent', () => {
  const ReactLocal = require('react');
  const { View } = require('react-native');
  const Mock = ReactLocal.forwardRef((props: Record<string, unknown>, ref: unknown) => {
    lastNativeProps = props as typeof lastNativeProps;
    return ReactLocal.createElement(View, { ref, testID: 'mock-banner' });
  });
  return {
    __esModule: true,
    default: Mock,
    Commands: { recordManualImpression: jest.fn(), load: jest.fn() },
  };
});

describe('BaseAd ResponseInfo native event wiring', () => {
  beforeEach(() => {
    lastNativeProps = {};
  });

  it('dispatches loaded / failed / paid / void banner events through handlers', () => {
    const onAdLoaded = jest.fn();
    const onAdFailedToLoad = jest.fn();
    const onPaid = jest.fn();
    const onAdOpened = jest.fn();
    const onAdClosed = jest.fn();
    const onAdClicked = jest.fn();
    const onAdImpression = jest.fn();
    const onSizeChange = jest.fn();
    const onAppEvent = jest.fn();

    render(
      <BannerAd
        unitId={MOCK_ID}
        size={BannerAdSize.BANNER}
        onAdLoaded={onAdLoaded}
        onAdFailedToLoad={onAdFailedToLoad}
        onPaid={onPaid}
        onAdOpened={onAdOpened}
        onAdClosed={onAdClosed}
        onAdClicked={onAdClicked}
        onAdImpression={onAdImpression}
        onSizeChange={onSizeChange}
        onAppEvent={onAppEvent}
      />,
    );

    const emit = (nativeEvent: Record<string, unknown>) => {
      act(() => {
        lastNativeProps.onNativeEvent!({ nativeEvent });
      });
    };

    emit({
      type: 'onAdLoaded',
      width: 320,
      height: 50,
      responseInfoJson: JSON.stringify({
        responseId: 'banner-ri',
        adapterClassName: null,
        loadedAdapterResponse: null,
        adapterResponses: [],
        extras: {},
      }),
    });
    expect(onAdLoaded).toHaveBeenCalledWith(
      expect.objectContaining({
        width: 320,
        height: 50,
        responseInfo: expect.objectContaining({ responseId: 'banner-ri' }),
      }),
    );

    emit({ type: 'onSizeChange', width: 300, height: 250 });
    expect(onSizeChange).toHaveBeenCalledWith({ width: 300, height: 250 });

    emit({
      type: 'onAdFailedToLoad',
      code: 'error-code-no-fill',
      message: 'no inventory',
    });
    expect(onAdFailedToLoad.mock.calls[0][0].reason).toBe('no-fill');

    emit({
      type: 'onPaid',
      currency: 'USD',
      precision: RevenuePrecisions.PRECISE,
      value: 0.01,
      valueMicros: '10000',
    });
    expect(onPaid).toHaveBeenCalledWith(
      expect.objectContaining({ currency: 'USD', valueMicros: '10000' }),
    );

    emit({
      type: 'onPaid',
      currency: 'USD',
      precision: RevenuePrecisions.ESTIMATED,
      value: 0.01,
      valueMicros: '',
    });
    expect(onPaid).toHaveBeenCalledWith(
      expect.objectContaining({ currency: 'USD', valueMicros: null }),
    );

    emit({ type: 'onAppEvent', name: 'gad', data: 'x' });
    expect(onAppEvent).toHaveBeenCalledWith({ name: 'gad', data: 'x' });

    emit({ type: 'onAdOpened' });
    emit({ type: 'onAdClosed' });
    emit({ type: 'onAdClicked' });
    emit({ type: 'onAdImpression' });
    expect(onAdOpened).toHaveBeenCalled();
    expect(onAdClosed).toHaveBeenCalled();
    expect(onAdClicked).toHaveBeenCalled();
    expect(onAdImpression).toHaveBeenCalled();
  });

  it('debounces fluid banner dimension updates on Android', () => {
    const osDescriptor = Object.getOwnPropertyDescriptor(Platform, 'OS');
    Object.defineProperty(Platform, 'OS', { configurable: true, get: () => 'android' });
    jest.useFakeTimers();
    try {
      render(<BannerAd unitId={MOCK_ID} size={GAMBannerAdSize.FLUID} />);
      act(() => {
        lastNativeProps.onNativeEvent!({
          nativeEvent: { type: 'onAdLoaded', width: 360, height: 100 },
        });
        jest.advanceTimersByTime(150);
      });
    } finally {
      jest.useRealTimers();
      if (osDescriptor) {
        Object.defineProperty(Platform, 'OS', osDescriptor);
      }
    }
  });
});
