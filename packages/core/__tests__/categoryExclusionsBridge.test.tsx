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
  GAMInterstitialAd,
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
const EXCLUSIONS = ['airline', 'automotive'];
const INVALID_MESSAGE = "'options.categoryExclusions' expected an array containing string values";

function lastCallArg(fn: unknown, index: number) {
  const calls = jest.mocked(fn as jest.Mock).mock.calls;
  return calls[calls.length - 1][index];
}

describe('categoryExclusions reaches every native bridge', () => {
  afterEach(() => {
    act(() => {
      destroyAllAdPools();
    });
    jest.clearAllMocks();
    lastBannerProps = {};
  });

  it.each([
    ['InterstitialAd', InterstitialAd, NativeInterstitialModule.interstitialLoad],
    ['GAMInterstitialAd', GAMInterstitialAd, NativeInterstitialModule.interstitialLoad],
    ['RewardedAd', RewardedAd, NativeRewardedModule.rewardedLoad],
    [
      'RewardedInterstitialAd',
      RewardedInterstitialAd,
      NativeRewardedInterstitialModule.rewardedInterstitialLoad,
    ],
    ['AppOpenAd', AppOpenAd, NativeAppOpenModule.appOpenLoad],
  ])('%s.createForAdRequest sends categoryExclusions on load', (_name, AdClass, nativeLoad) => {
    const ad = AdClass.createForAdRequest(GAM_UNIT, { categoryExclusions: EXCLUSIONS });
    ad.load();
    expect(lastCallArg(nativeLoad, 2).categoryExclusions).toEqual(EXCLUSIONS);
    ad.destroy();
  });

  it('fullscreen createForAdRequest omits an empty categoryExclusions array', () => {
    const ad = InterstitialAd.createForAdRequest(GAM_UNIT, { categoryExclusions: [] });
    ad.load();
    expect(lastCallArg(NativeInterstitialModule.interstitialLoad, 2)).not.toHaveProperty(
      'categoryExclusions',
    );
    ad.destroy();
  });

  it('fullscreen createForAdRequest rejects non-string members', () => {
    expect(() =>
      InterstitialAd.createForAdRequest(GAM_UNIT, {
        // @ts-expect-error intentional invalid input
        categoryExclusions: ['airline', 1],
      }),
    ).toThrow(INVALID_MESSAGE);
  });

  it('BannerAd sends categoryExclusions in the native request prop', () => {
    render(
      <BannerAd
        unitId="ca-app-pub-test/banner"
        size={BannerAdSize.BANNER}
        requestOptions={{ categoryExclusions: EXCLUSIONS }}
      />,
    );
    expect(JSON.parse(lastBannerProps.request ?? '{}').categoryExclusions).toEqual(EXCLUSIONS);
  });

  it('GAMBannerAd sends categoryExclusions in the native request prop', () => {
    render(
      <GAMBannerAd
        unitId={GAM_UNIT}
        sizes={[GAMBannerAdSize.BANNER]}
        requestOptions={{ categoryExclusions: EXCLUSIONS }}
      />,
    );
    expect(JSON.parse(lastBannerProps.request ?? '{}').categoryExclusions).toEqual(EXCLUSIONS);
  });

  it('GAMBannerAd rejects a non-array categoryExclusions value', () => {
    expect(() =>
      render(
        <GAMBannerAd
          unitId={GAM_UNIT}
          sizes={[GAMBannerAdSize.BANNER]}
          // @ts-expect-error intentional invalid input
          requestOptions={{ categoryExclusions: 'airline' }}
        />,
      ),
    ).toThrow(`BannerAd: ${INVALID_MESSAGE}`);
  });

  it('NativeAd.createForAdRequest sends categoryExclusions on load', async () => {
    const ad = await NativeAd.createForAdRequest(GAM_UNIT, { categoryExclusions: EXCLUSIONS });
    expect(lastCallArg(NativeGoogleMobileAdsNativeModule.load, 1).categoryExclusions).toEqual(
      EXCLUSIONS,
    );
    ad.destroy();
  });

  it('MultiFormatAdRequest sends categoryExclusions on loadMultiFormat', async () => {
    const request = MultiFormatAdRequest.create({
      adUnitId: GAM_UNIT,
      requestOptions: {
        ...MultiFormatAdPresets.nativeOrBanner([BannerAdSize.MEDIUM_RECTANGLE]),
        categoryExclusions: EXCLUSIONS,
      },
    });
    await request.load();
    expect(
      lastCallArg(NativeGoogleMobileAdsNativeModule.loadMultiFormat, 1).categoryExclusions,
    ).toEqual(EXCLUSIONS);
  });

  it('AdPools.create fullscreen pool sends categoryExclusions on poolStart', async () => {
    const pool = await AdPools.create(
      AdPoolPresets.fullscreen(AdFormat.INTERSTITIAL, GAM_UNIT, {
        requestOptions: { categoryExclusions: EXCLUSIONS },
      }),
    );
    expect(pool.resolved.requestOptions?.categoryExclusions).toEqual(EXCLUSIONS);
    expect(lastCallArg(NativeGoogleMobileAdsPoolModule.poolStart, 5).categoryExclusions).toEqual(
      EXCLUSIONS,
    );
  });

  it('AdPools.create display pool sends categoryExclusions on loadMultiFormat', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const pool = await AdPools.create(
        AdPoolPresets.display(GAM_UNIT, {
          bannerSizes: [BannerAdSize.BANNER],
          requestOptions: { categoryExclusions: EXCLUSIONS },
        }),
      );
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(pool.resolved.requestOptions?.categoryExclusions).toEqual(EXCLUSIONS);
      expect(
        lastCallArg(NativeGoogleMobileAdsNativeModule.loadMultiFormat, 1).categoryExclusions,
      ).toEqual(EXCLUSIONS);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('created in degraded mode'));
    } finally {
      warn.mockRestore();
    }
  });

  it('AdPools.create rejects invalid categoryExclusions', async () => {
    await expect(
      AdPools.create(
        AdPoolPresets.fullscreen(AdFormat.INTERSTITIAL, GAM_UNIT, {
          // @ts-expect-error intentional invalid input
          requestOptions: { categoryExclusions: [null] },
        }),
      ),
    ).rejects.toThrow(INVALID_MESSAGE);
  });
});
