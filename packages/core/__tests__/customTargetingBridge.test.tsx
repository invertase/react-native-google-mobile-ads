import React from 'react';
import { act, render } from '@testing-library/react-native';

import {
  AdFormat,
  AdPoolPresets,
  AdPools,
  AppOpenAd,
  BannerAd,
  BannerAdSize,
  GAMBannerAd,
  GAMBannerAdSize,
  InterstitialAd,
  MultiFormatAdPresets,
  MultiFormatAdRequest,
  RewardedAd,
  RewardedInterstitialAd,
} from '../src';
import { NativeAd } from '../src/ads/native-ad/NativeAd';
import { destroyAllAdPools } from '../src/internal/adPoolRegistry';
import NativeAppOpenModule from '../src/specs/modules/NativeAppOpenModule';
import NativeGoogleMobileAdsNativeModule from '../src/specs/modules/NativeGoogleMobileAdsNativeModule';
import NativeGoogleMobileAdsPoolModule from '../src/specs/modules/NativeGoogleMobileAdsPoolModule';
import NativeInterstitialModule from '../src/specs/modules/NativeInterstitialModule';
import NativeRewardedInterstitialModule from '../src/specs/modules/NativeRewardedInterstitialModule';
import NativeRewardedModule from '../src/specs/modules/NativeRewardedModule';

let lastBannerProps: { request?: string } = {};

jest.mock('../src/specs/components/GoogleMobileAdsBannerViewNativeComponent', () => {
  const ReactLocal = require('react');
  const { View } = require('react-native');
  const Mock = ReactLocal.forwardRef((props: Record<string, unknown>, ref: unknown) => {
    lastBannerProps = props as typeof lastBannerProps;
    return ReactLocal.createElement(View, { ref });
  });
  return {
    __esModule: true,
    default: Mock,
    Commands: { recordManualImpression: jest.fn(), load: jest.fn() },
  };
});

jest.mock('../src/specs/modules/NativeRewardedModule', () => ({
  __esModule: true,
  default: { rewardedLoad: jest.fn(), rewardedShow: jest.fn(), rewardedDestroy: jest.fn() },
}));

jest.mock('../src/specs/modules/NativeRewardedInterstitialModule', () => ({
  __esModule: true,
  default: {
    rewardedInterstitialLoad: jest.fn(),
    rewardedInterstitialShow: jest.fn(),
    rewardedInterstitialDestroy: jest.fn(),
  },
}));

jest.mock('../src/specs/modules/NativeAppOpenModule', () => ({
  __esModule: true,
  default: { appOpenLoad: jest.fn(), appOpenShow: jest.fn(), appOpenDestroy: jest.fn() },
}));

const GAM_UNIT = '/123/unit';
const NUMERIC_TARGETING = { section: 'sports', subscriber: 1, ages: [18, '25-34'] };
const COERCED_TARGETING = { section: 'sports', subscriber: '1', ages: ['18', '25-34'] };

function lastCallArg(fn: unknown, index: number) {
  const calls = jest.mocked(fn as jest.Mock).mock.calls;
  return calls[calls.length - 1][index];
}

describe('customTargeting reaches every native bridge as strings', () => {
  afterEach(() => {
    act(() => {
      destroyAllAdPools();
    });
    jest.clearAllMocks();
    lastBannerProps = {};
  });

  it.each([
    ['InterstitialAd', InterstitialAd, NativeInterstitialModule.interstitialLoad],
    ['RewardedAd', RewardedAd, NativeRewardedModule.rewardedLoad],
    [
      'RewardedInterstitialAd',
      RewardedInterstitialAd,
      NativeRewardedInterstitialModule.rewardedInterstitialLoad,
    ],
    ['AppOpenAd', AppOpenAd, NativeAppOpenModule.appOpenLoad],
  ])('%s.createForAdRequest coerces numbers before load', (_name, AdClass, nativeLoad) => {
    const ad = AdClass.createForAdRequest('unit', { customTargeting: NUMERIC_TARGETING });
    ad.load();
    expect(lastCallArg(nativeLoad, 2).customTargeting).toEqual(COERCED_TARGETING);
    ad.destroy();
  });

  it('fullscreen createForAdRequest rejects non-finite numbers', () => {
    expect(() =>
      InterstitialAd.createForAdRequest('unit', { customTargeting: { bad: NaN } }),
    ).toThrow('\'options.customTargeting\' expected a finite number for object key "bad"');
  });

  it('BannerAd sends coerced customTargeting in the native request prop', () => {
    render(
      <BannerAd
        unitId="ca-app-pub-test/banner"
        size={BannerAdSize.BANNER}
        requestOptions={{ customTargeting: NUMERIC_TARGETING }}
      />,
    );
    expect(JSON.parse(lastBannerProps.request ?? '{}').customTargeting).toEqual(
      COERCED_TARGETING,
    );
  });

  it('GAMBannerAd sends coerced customTargeting in the native request prop', () => {
    render(
      <GAMBannerAd
        unitId={GAM_UNIT}
        sizes={[GAMBannerAdSize.BANNER]}
        requestOptions={{ customTargeting: NUMERIC_TARGETING }}
      />,
    );
    expect(JSON.parse(lastBannerProps.request ?? '{}').customTargeting).toEqual(
      COERCED_TARGETING,
    );
  });

  it('BannerAd rejects invalid customTargeting values', () => {
    expect(() =>
      render(
        <BannerAd
          unitId="ca-app-pub-test/banner"
          size={BannerAdSize.BANNER}
          // @ts-expect-error intentional invalid input
          requestOptions={{ customTargeting: { bad: true } }}
        />,
      ),
    ).toThrow(
      'BannerAd: \'options.customTargeting\' expected a string, number, or array of strings and numbers for object key "bad"',
    );
  });

  it('NativeAd.createForAdRequest coerces numbers before load', async () => {
    const ad = await NativeAd.createForAdRequest('unit', { customTargeting: NUMERIC_TARGETING });
    expect(lastCallArg(NativeGoogleMobileAdsNativeModule.load, 1).customTargeting).toEqual(
      COERCED_TARGETING,
    );
    ad.destroy();
  });

  it('MultiFormatAdRequest coerces numbers before loadMultiFormat', async () => {
    const request = MultiFormatAdRequest.create({
      adUnitId: GAM_UNIT,
      requestOptions: {
        ...MultiFormatAdPresets.nativeOrBanner([BannerAdSize.MEDIUM_RECTANGLE]),
        customTargeting: NUMERIC_TARGETING,
      },
    });
    await request.load();
    expect(
      lastCallArg(NativeGoogleMobileAdsNativeModule.loadMultiFormat, 1).customTargeting,
    ).toEqual(COERCED_TARGETING);
  });

  it('AdPools.create fullscreen pool coerces numbers before poolStart', async () => {
    const pool = await AdPools.create(
      AdPoolPresets.fullscreen(AdFormat.INTERSTITIAL, 'unit', {
        requestOptions: { customTargeting: NUMERIC_TARGETING },
      }),
    );
    expect(pool.resolved.requestOptions?.customTargeting).toEqual(COERCED_TARGETING);
    expect(lastCallArg(NativeGoogleMobileAdsPoolModule.poolStart, 5).customTargeting).toEqual(
      COERCED_TARGETING,
    );
  });

  it('AdPools.create display pool coerces numbers before loadMultiFormat', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const pool = await AdPools.create(
        AdPoolPresets.display(GAM_UNIT, {
          bannerSizes: [BannerAdSize.BANNER],
          requestOptions: { customTargeting: NUMERIC_TARGETING },
        }),
      );
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(pool.resolved.requestOptions?.customTargeting).toEqual(COERCED_TARGETING);
      expect(
        lastCallArg(NativeGoogleMobileAdsNativeModule.loadMultiFormat, 1).customTargeting,
      ).toEqual(COERCED_TARGETING);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('created in degraded mode'));
    } finally {
      warn.mockRestore();
    }
  });

  it('AdPools.create rejects invalid customTargeting values', async () => {
    await expect(
      AdPools.create(
        AdPoolPresets.fullscreen(AdFormat.INTERSTITIAL, 'unit', {
          requestOptions: { customTargeting: { bad: Infinity } },
        }),
      ),
    ).rejects.toThrow('\'options.customTargeting\' expected a finite number for object key "bad"');
  });
});
