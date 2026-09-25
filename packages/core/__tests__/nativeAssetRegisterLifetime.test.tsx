/*
 * Copyright (c) 2016-present Invertase Limited & Contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this library except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React from 'react';
import { Text, findNodeHandle } from 'react-native';
import { act, render } from '@testing-library/react-native';
import { NativeAd } from '../src/ads/native-ad/NativeAd';
import { NativeAdContext } from '../src/ads/native-ad/NativeAdContext';
import { NativeAdView } from '../src/ads/native-ad/NativeAdView';
import { NativeAsset, NativeAssetType } from '../src/ads/native-ad/NativeAsset';
import NativeGoogleMobileAdsNativeModule from '../src/specs/modules/NativeGoogleMobileAdsNativeModule';
import { Commands } from '../src/specs/components/GoogleMobileAdsNativeViewNativeComponent';

jest.mock('../src/specs/modules/NativeGoogleMobileAdsNativeModule', () => ({
  __esModule: true,
  default: {
    load: jest.fn(),
    destroy: jest.fn(),
    onAdEvent: jest.fn(() => ({ remove: jest.fn() })),
  },
}));

jest.mock('../src/specs/components/GoogleMobileAdsNativeViewNativeComponent', () => {
  const ReactLocal = require('react');
  const { View } = require('react-native');
  const Mock = ReactLocal.forwardRef((props: Record<string, unknown>, ref: unknown) =>
    ReactLocal.createElement(View, { ...props, ref, testID: 'mock-native-ad-view' }),
  );
  return {
    __esModule: true,
    default: Mock,
    Commands: { registerAsset: jest.fn() },
  };
});

jest.mock('react-native/Libraries/ReactNative/RendererProxy', () => {
  const actual = jest.requireActual('react-native/Libraries/ReactNative/RendererProxy');
  return {
    ...actual,
    findNodeHandle: jest.fn((node: unknown) => (node == null ? null : 4242)),
  };
});

async function loadNativeAd(responseId: string): Promise<NativeAd> {
  (NativeGoogleMobileAdsNativeModule.load as jest.Mock).mockResolvedValueOnce({
    responseId,
    advertiser: null,
    body: 'body',
    callToAction: 'Install',
    headline: `headline-${responseId}`,
    price: null,
    store: null,
    starRating: null,
    icon: null,
    images: null,
    mediaContent: { aspectRatio: 1, hasVideoContent: false, duration: 0 },
    extras: null,
  });
  return NativeAd.createForAdRequest('ca-app-pub-test/native');
}

describe('NativeAsset registerAsset lifetime (#735 FlatList rebind)', () => {
  beforeEach(() => {
    (Commands.registerAsset as jest.Mock).mockClear();
    (findNodeHandle as jest.Mock).mockImplementation((node: unknown) =>
      node == null ? null : 4242,
    );
  });

  it('re-registers assets when NativeAdView rebinds a different responseId (FlatList recycle)', async () => {
    const first = await loadNativeAd('flatlist-ad-1');
    const second = await loadNativeAd('flatlist-ad-2');

    const screen = render(
      <NativeAdView nativeAd={first}>
        <NativeAsset assetType={NativeAssetType.HEADLINE}>
          <Text>{first.headline}</Text>
        </NativeAsset>
      </NativeAdView>,
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(Commands.registerAsset).toHaveBeenCalledTimes(1);
    expect(Commands.registerAsset).toHaveBeenLastCalledWith(
      expect.anything(),
      NativeAssetType.HEADLINE,
      4242,
    );

    // FlatList cell reuse: same NativeAdView/NativeAsset tree, new preloaded NativeAd.
    screen.rerender(
      <NativeAdView nativeAd={second}>
        <NativeAsset assetType={NativeAssetType.HEADLINE}>
          <Text>{second.headline}</Text>
        </NativeAsset>
      </NativeAdView>,
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(Commands.registerAsset).toHaveBeenCalledTimes(2);
    expect(Commands.registerAsset).toHaveBeenLastCalledWith(
      expect.anything(),
      NativeAssetType.HEADLINE,
      4242,
    );

    first.destroy();
    second.destroy();
  });

  it('registers CALL_TO_ACTION with wire value callToAction (#724)', async () => {
    // Docs historically showed NativeAssetType.CTA / nativeAd.cta — neither exists.
    // Wrong assetType never reaches GMA callToActionView, so the button appears dead.
    expect(NativeAssetType.CALL_TO_ACTION).toBe('callToAction');
    expect((NativeAssetType as Record<string, string>).CTA).toBeUndefined();

    const ad = await loadNativeAd('cta-wire-ad');
    render(
      <NativeAdView nativeAd={ad}>
        <NativeAsset assetType={NativeAssetType.CALL_TO_ACTION}>
          <Text>{ad.callToAction}</Text>
        </NativeAsset>
      </NativeAdView>,
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(Commands.registerAsset).toHaveBeenCalledWith(
      expect.anything(),
      'callToAction',
      4242,
    );
    ad.destroy();
  });

  it('skips registerAsset when the host NativeAdView ref is not attached yet', async () => {
    const ad = await loadNativeAd('flatlist-ad-no-host');
    const emptyViewRef = { current: null };

    render(
      <NativeAdContext.Provider value={{ nativeAd: ad, viewRef: emptyViewRef }}>
        <NativeAsset assetType={NativeAssetType.BODY}>
          <Text>{ad.body}</Text>
        </NativeAsset>
      </NativeAdContext.Provider>,
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(Commands.registerAsset).not.toHaveBeenCalled();
    ad.destroy();
  });

  it('renders null when children is not a valid React element', async () => {
    const ad = await loadNativeAd('flatlist-ad-invalid-child');

    const screen = render(
      <NativeAdView nativeAd={ad}>
        {/* force invalid child past the TypeScript ReactElement prop */}
        <NativeAsset assetType={NativeAssetType.HEADLINE}>{null as unknown as React.ReactElement}</NativeAsset>
      </NativeAdView>,
    );

    expect(screen.toJSON()).toMatchObject({
      props: expect.objectContaining({ responseId: 'flatlist-ad-invalid-child' }),
    });
    expect(Commands.registerAsset).not.toHaveBeenCalled();
    ad.destroy();
  });
});
