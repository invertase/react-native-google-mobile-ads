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

import React, { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { act, render } from '@testing-library/react-native';
import { NativeAd } from '../src/ads/native-ad/NativeAd';
import { NativeAdView } from '../src/ads/native-ad/NativeAdView';
import { NativeAsset, NativeAssetType } from '../src/ads/native-ad/NativeAsset';
import NativeGoogleMobileAdsNativeModule from '../src/specs/modules/NativeGoogleMobileAdsNativeModule';

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

/**
 * FlashList / FlatList recycle JS state. A card that loads once in useEffect([])
 * and never keys/reloads on item identity keeps the previous NativeAd (#761).
 * Reloading when itemId changes must destroy the old ad and rebind responseId.
 */
describe('NativeAdView FlashList-style cell recycle (#761)', () => {
  it('updates responseId and destroys the previous ad when item identity changes', async () => {
    const first = await loadNativeAd('flashlist-ad-1');
    const second = await loadNativeAd('flashlist-ad-2');
    const create = jest
      .spyOn(NativeAd, 'createForAdRequest')
      .mockResolvedValueOnce(first)
      .mockResolvedValueOnce(second);

    function RecycledNativeAdCard({ itemId }: { itemId: string }) {
      const [nativeAd, setNativeAd] = useState<NativeAd>();

      useEffect(() => {
        let cancelled = false;
        let loaded: NativeAd | undefined;
        NativeAd.createForAdRequest('ca-app-pub-test/native')
          .then(ad => {
            if (cancelled) {
              ad.destroy();
              return;
            }
            loaded = ad;
            setNativeAd(ad);
          })
          .catch(() => undefined);
        return () => {
          cancelled = true;
          loaded?.destroy();
          setNativeAd(undefined);
        };
      }, [itemId]);

      if (!nativeAd) {
        return null;
      }

      return (
        <NativeAdView nativeAd={nativeAd} testID="card">
          <NativeAsset assetType={NativeAssetType.HEADLINE}>
            <Text>{nativeAd.headline}</Text>
          </NativeAsset>
        </NativeAdView>
      );
    }

    const screen = render(<RecycledNativeAdCard itemId="row-a" />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByTestId('mock-native-ad-view').props.responseId).toBe('flashlist-ad-1');
    expect(create).toHaveBeenCalledTimes(1);

    screen.rerender(<RecycledNativeAdCard itemId="row-b" />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(NativeGoogleMobileAdsNativeModule.destroy).toHaveBeenCalledWith('flashlist-ad-1');
    expect(create).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('mock-native-ad-view').props.responseId).toBe('flashlist-ad-2');

    first.destroy();
    second.destroy();
    create.mockRestore();
  });

  it('leaves responseId unchanged when the same NativeAd instance is kept across a no-op recycle', async () => {
    const ad = await loadNativeAd('flashlist-same-ad');

    const screen = render(
      <NativeAdView nativeAd={ad}>
        <NativeAsset assetType={NativeAssetType.BODY}>
          <Text>{ad.body}</Text>
        </NativeAsset>
      </NativeAdView>,
    );

    expect(screen.getByTestId('mock-native-ad-view').props.responseId).toBe('flashlist-same-ad');

    screen.rerender(
      <NativeAdView nativeAd={ad}>
        <NativeAsset assetType={NativeAssetType.BODY}>
          <Text>{ad.body}</Text>
        </NativeAsset>
      </NativeAdView>,
    );

    expect(screen.getByTestId('mock-native-ad-view').props.responseId).toBe('flashlist-same-ad');
    ad.destroy();
  });
});
