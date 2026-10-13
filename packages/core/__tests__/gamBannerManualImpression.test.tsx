import React, { createRef } from 'react';
import { render } from '@testing-library/react-native';

import { GAMBannerAd, GAMBannerAdSize, TestIds } from '../src';
import { Commands } from '../src/specs/components/GoogleMobileAdsBannerViewNativeComponent';

let lastNativeProps: {
  manualImpressionsEnabled?: boolean;
} = {};

jest.mock('../src/specs/components/GoogleMobileAdsBannerViewNativeComponent', () => {
  const ReactLocal = require('react');
  const { View } = require('react-native');
  const Mock = ReactLocal.forwardRef((props: Record<string, unknown>, ref: unknown) => {
    lastNativeProps = props as typeof lastNativeProps;
    return ReactLocal.createElement(View, { ref, testID: 'mock-gam-banner' });
  });
  return {
    __esModule: true,
    default: Mock,
    Commands: { recordManualImpression: jest.fn(), load: jest.fn() },
  };
});

describe('GAMBannerAd manual impression ownership', () => {
  beforeEach(() => {
    lastNativeProps = {};
    jest.clearAllMocks();
  });

  it('routes recordManualImpression through Commands when the native ref is mounted', () => {
    const adRef = createRef<GAMBannerAd>();
    render(
      <GAMBannerAd
        ref={adRef}
        unitId={TestIds.GAM_BANNER}
        sizes={[GAMBannerAdSize.BANNER]}
        manualImpressionsEnabled
      />,
    );

    adRef.current!.recordManualImpression();

    expect(Commands.recordManualImpression).toHaveBeenCalledTimes(1);
    expect(Commands.recordManualImpression).toHaveBeenCalledWith(expect.anything());
  });

  it('does not call Commands.recordManualImpression when the native ref is absent', () => {
    const adRef = createRef<GAMBannerAd>();
    const { unmount } = render(
      <GAMBannerAd
        ref={adRef}
        unitId={TestIds.GAM_BANNER}
        sizes={[GAMBannerAdSize.BANNER]}
        manualImpressionsEnabled
      />,
    );
    const instance = adRef.current!;
    unmount();
    jest.clearAllMocks();

    instance.recordManualImpression();
    instance.load();

    expect(Commands.recordManualImpression).not.toHaveBeenCalled();
    expect(Commands.load).not.toHaveBeenCalled();
  });

  it('forwards default manualImpressionsEnabled as false', () => {
    render(<GAMBannerAd unitId={TestIds.GAM_BANNER} sizes={[GAMBannerAdSize.BANNER]} />);
    expect(lastNativeProps.manualImpressionsEnabled).toBe(false);
  });

  it('forwards manualImpressionsEnabled={true} to the native prop', () => {
    render(
      <GAMBannerAd
        unitId={TestIds.GAM_BANNER}
        sizes={[GAMBannerAdSize.BANNER]}
        manualImpressionsEnabled={true}
      />,
    );
    expect(lastNativeProps.manualImpressionsEnabled).toBe(true);
  });
});
