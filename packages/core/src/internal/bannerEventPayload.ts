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

import { RevenuePrecisions } from '../common/constants';
import type { PaidResponseInfo, ResponseInfo } from '../types/ResponseInfo';
import { adErrorFromNativeEvent, parseResponseInfoPayload } from './adErrorFromNativeEvent';

export type BannerNativeEvent =
  | {
      type: 'onAdLoaded' | 'onSizeChange';
      width: number;
      height: number;
      responseInfo?: ResponseInfo;
      responseInfoJson?: string;
    }
  | { type: 'onAdOpened' | 'onAdClosed' | 'onAdImpression' | 'onAdClicked' }
  | {
      type: 'onAdFailedToLoad';
      code: string;
      message: string;
      responseInfo?: ResponseInfo;
      responseInfoJson?: string;
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
      valueMicros?: string | null;
      responseInfo?: PaidResponseInfo;
      responseInfoJson?: string;
    };

/**
 * Pure mapping from a banner native event to the public JS handler payload.
 * Returns null when the event type has no payload (opened/closed/…).
 */
export function bannerEventPayload(nativeEvent: BannerNativeEvent): unknown {
  switch (nativeEvent.type) {
    case 'onAdLoaded':
      return {
        width: nativeEvent.width,
        height: nativeEvent.height,
        responseInfo: parseResponseInfoPayload(nativeEvent),
      };
    case 'onSizeChange':
      return {
        width: nativeEvent.width,
        height: nativeEvent.height,
      };
    case 'onAdFailedToLoad':
      return adErrorFromNativeEvent(nativeEvent, 'googleMobileAds', 'load');
    case 'onAppEvent':
      return {
        name: nativeEvent.name,
        data: nativeEvent.data,
      };
    case 'onPaid': {
      // Fabric optional strings arrive as "" when unset; contract is null when inexact.
      const rawMicros = nativeEvent.valueMicros;
      const valueMicros = rawMicros == null || rawMicros === '' ? null : rawMicros;
      return {
        currency: nativeEvent.currency,
        precision: nativeEvent.precision,
        value: nativeEvent.value,
        valueMicros,
        responseInfo: parseResponseInfoPayload<PaidResponseInfo>(nativeEvent),
      };
    }
    default:
      return undefined;
  }
}
