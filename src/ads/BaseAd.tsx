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
 *
 */

import React, { useState, useEffect, useMemo } from 'react';
import { DimensionValue, NativeSyntheticEvent, Platform } from 'react-native';
import { isFunction } from '../common';
import { RevenuePrecisions } from '../common/constants';
import { NativeError } from '../internal/NativeError';
import GoogleMobileAdsBannerView from '../specs/components/GoogleMobileAdsBannerViewNativeComponent';
import type { NativeEvent } from '../specs/components/GoogleMobileAdsBannerViewNativeComponent';
import { BannerAdSize, GAMBannerAdSize } from '../BannerAdSize';
import { validateAdRequestOptions } from '../validateAdRequestOptions';
import { GAMBannerAdProps } from '../types/BannerAdProps';
import { debounce } from '../common/debounce';

const sizeRegex = /([0-9]+)x([0-9]+)/;

export const BaseAd = React.forwardRef<
  React.ComponentRef<typeof GoogleMobileAdsBannerView>,
  GAMBannerAdProps
>(
  (
    { unitId, sizes, maxHeight, width, requestOptions, manualImpressionsEnabled, ...props },
    ref,
  ) => {
    const [dimensions, setDimensions] = useState<(number | DimensionValue)[]>([0, 0]);

    const debouncedSetDimensions = debounce(setDimensions, 100);

    useEffect(() => {
      if (!unitId) {
        throw new Error("BannerAd: 'unitId' expected a valid string unit ID.");
      }
    }, [unitId]);

    useEffect(() => {
      if (
        sizes.length === 0 ||
        !sizes.every(
          size => size in BannerAdSize || size in GAMBannerAdSize || sizeRegex.test(size),
        )
      ) {
        throw new Error("BannerAd: 'size(s)' expected a valid BannerAdSize or custom size string.");
      }
    }, [sizes]);

    const validatedRequestOptions = useMemo(() => {
      if (requestOptions) {
        try {
          return validateAdRequestOptions(requestOptions);
        } catch (e) {
          if (e instanceof Error) {
            throw new Error(`BannerAd: ${e.message}`);
          }
        }
      }
      return {};
    }, [requestOptions]);

    function onNativeEvent(event: NativeSyntheticEvent<NativeEvent>) {
      const nativeEvent = event.nativeEvent as
        | {
            type: 'onAdLoaded' | 'onSizeChange';
            width: number;
            height: number;
          }
        | { type: 'onAdOpened' | 'onAdClosed' | 'onAdImpression' | 'onAdClicked' }
        | {
            type: 'onAdFailedToLoad';
            code: string;
            message: string;
          }
        | {
            type: 'onAppEvent';
            name: string;
            data?: string;
          }
        | {
            type: 'onPaid';
            currency: string;
            precision: RevenuePrecisions;
            value: number;
          };
      const { type } = nativeEvent;

      if (isFunction(props[type])) {
        let eventHandler, eventPayload;
        switch (type) {
          case 'onAdLoaded':
          case 'onSizeChange':
            eventPayload = {
              width: nativeEvent.width,
              height: nativeEvent.height,
            };
            if ((eventHandler = props[type])) eventHandler(eventPayload);
            break;
          case 'onAdFailedToLoad':
            eventPayload = NativeError.fromEvent(nativeEvent, 'googleMobileAds');
            if ((eventHandler = props[type])) eventHandler(eventPayload);
            break;
          case 'onAppEvent':
            eventPayload = {
              name: nativeEvent.name,
              data: nativeEvent.data,
            };
            if ((eventHandler = props[type])) eventHandler(eventPayload);
            break;
          case 'onPaid':
            const handler = props[type];
            if (handler) {
              handler({
                currency: nativeEvent.currency,
                precision: nativeEvent.precision,
                value: nativeEvent.value,
              });
            }
            break;
          default:
            if ((eventHandler = props[type])) eventHandler();
        }
      }

      if (type === 'onAdLoaded' || type === 'onSizeChange') {
        const width = Math.ceil(nativeEvent.width);
        const height = Math.ceil(nativeEvent.height);

        if (width && height && JSON.stringify([width, height]) !== JSON.stringify(dimensions)) {
          /**
           * On Android, it seems the ad size is not always the definitive on the first onAdLoaded event.
           * So if we change the size here with an incorrect value, then we relayout the ad on native side
           * and it might cause an incorrect size to be set.
           *
           * To reproduce this issue, go to the example app, on the "GAMBanner Fluid" example
           * and reload the ad several times
           *
           * on my low-end Samsung A10s, it always took less than 100ms in debug mode to get the correct size
           * hence the 100ms debounce
           */
          if (sizes.includes(GAMBannerAdSize.FLUID) && Platform.OS === 'android') {
            debouncedSetDimensions([width, height]);
          } else {
            setDimensions([width, height]);
          }
        }
      }
    }

    const style = sizes.includes(GAMBannerAdSize.FLUID)
      ? {
          width: '100%' as DimensionValue,
          height: dimensions[1],
        }
      : {
          width: dimensions[0],
          height: dimensions[1],
        };

    return (
      <GoogleMobileAdsBannerView
        ref={ref}
        sizeConfig={{ sizes, maxHeight, width }}
        style={style}
        unitId={unitId}
        request={JSON.stringify(validatedRequestOptions)}
        manualImpressionsEnabled={!!manualImpressionsEnabled}
        onNativeEvent={onNativeEvent}
      />
    );
  },
);
BaseAd.displayName = 'BaseAd';
