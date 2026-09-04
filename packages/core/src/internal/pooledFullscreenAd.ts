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

import { EmitterSubscription } from 'react-native';

import { AdEventType } from '../AdEventType';
import { GAMAdEventType } from '../GAMAdEventType';
import { RewardedAdEventType } from '../RewardedAdEventType';
import { isFunction, isOneOf } from '../common';
import { adErrorFromNativeEvent, parseResponseInfoPayload } from './adErrorFromNativeEvent';
import { createAdExpiry } from './adExpiry';
import { allocateFullscreenRequestId } from './fullscreenRequestIds';
import { SharedEventEmitter } from './SharedEventEmitter';
import NativeAppOpenModule from '../specs/modules/NativeAppOpenModule';
import NativeInterstitialModule from '../specs/modules/NativeInterstitialModule';
import NativeRewardedInterstitialModule from '../specs/modules/NativeRewardedInterstitialModule';
import NativeRewardedModule from '../specs/modules/NativeRewardedModule';
import type { AdEventListener, AdEventPayload } from '../types/AdEventListener';
import type { AdEventsListener } from '../types/AdEventsListener';
import type { AdShowOptions } from '../types/AdShowOptions';
import { AdFormat } from '../types/AdFormat';
import type { FullscreenAdFormat } from '../types/FullscreenAdFormat';
import type { PooledAd } from '../types/AdPool';
import type { ResponseInfo } from '../types/ResponseInfo';
import { validateAdShowOptions } from '../validateAdShowOptions';

type EventType = AdEventType | RewardedAdEventType | GAMAdEventType;

type ShowFn = (requestId: number, adUnitId: string, showOptions?: AdShowOptions) => Promise<void>;
type DestroyFn = (requestId: number) => void;

function nativeBridgeForFormat(format: FullscreenAdFormat): {
  eventType: string;
  show: ShowFn;
  destroy: DestroyFn;
} {
  switch (format) {
    case AdFormat.APP_OPEN:
      return {
        eventType: 'app_open',
        show: (id, unitId, opts) => NativeAppOpenModule.appOpenShow(id, unitId, opts),
        destroy: id => {
          NativeAppOpenModule.appOpenDestroy(id);
        },
      };
    case AdFormat.INTERSTITIAL:
      return {
        eventType: 'interstitial',
        show: (id, unitId, opts) => NativeInterstitialModule.interstitialShow(id, unitId, opts),
        destroy: id => {
          NativeInterstitialModule.interstitialDestroy(id);
        },
      };
    case AdFormat.REWARDED:
      return {
        eventType: 'rewarded',
        show: (id, unitId, opts) => NativeRewardedModule.rewardedShow(id, unitId, opts),
        destroy: id => {
          NativeRewardedModule.rewardedDestroy(id);
        },
      };
    case AdFormat.REWARDED_INTERSTITIAL:
      return {
        eventType: 'rewarded_interstitial',
        show: (id, unitId, opts) =>
          NativeRewardedInterstitialModule.rewardedInterstitialShow(id, unitId, opts),
        destroy: id => {
          NativeRewardedInterstitialModule.rewardedInterstitialDestroy(id);
        },
      };
    default: {
      throw new Error(`Unsupported pooled format: ${String(format)}`);
    }
  }
}

let nextAdId = 0;

export function allocatePooledAdId(): string {
  nextAdId += 1;
  return `pool-ad-${nextAdId}`;
}

export type CreatePooledFullscreenAdOptions = {
  format: FullscreenAdFormat;
  adUnitId: string;
  requestId: number;
  responseInfo: ResponseInfo | null;
  /**
   * When the library first observed this response id become available, or null
   * when never seen (SDK-managed provenance).
   */
  observedAt: number | null;
  stalenessWindowMillis?: number;
};

/**
 * Builds a fullscreen PooledAd from a native poll that already adopted the ad
 * into the format module under `requestId`.
 */
export function createPooledFullscreenAd(
  options: CreatePooledFullscreenAdOptions,
): Extract<PooledAd, { show: (opts?: AdShowOptions) => Promise<void> }> {
  const bridge = nativeBridgeForFormat(options.format);
  const adId = allocatePooledAdId();
  const expiry = createAdExpiry({
    observedAt: options.observedAt,
    stalenessWindowMillis: options.stalenessWindowMillis,
    format: options.format === AdFormat.APP_OPEN ? 'app_open' : 'other',
  });

  let destroyed = false;
  let showRequested = false;
  let responseInfo = options.responseInfo;

  const adEventsListeners = new Map<number, AdEventsListener<EventType>>();
  const adEventListenersMap = new Map<EventType, Map<number, AdEventListener<EventType>>>();
  Object.values({
    ...AdEventType,
    ...RewardedAdEventType,
    ...GAMAdEventType,
    _: AdEventType.LOADED,
  }).forEach(type => {
    adEventListenersMap.set(type as EventType, new Map());
  });
  let adEventsListenerId = 0;
  let adEventListenerId = 0;

  const nativeListener: EmitterSubscription = SharedEventEmitter.addListener(
    `google_mobile_ads_${bridge.eventType}_event:${options.adUnitId}:${options.requestId}`,
    (event: {
      body: {
        type: EventType;
        error?: {
          code: string;
          message: string;
          responseInfo?: ResponseInfo;
          responseInfoJson?: string;
          reason?: string;
          phase?: 'load' | 'show';
        };
        data?: { responseInfo?: ResponseInfo } & Record<string, unknown>;
      };
    }) => {
      if (destroyed) {
        return;
      }
      const { type, error, data } = event.body;
      const nested = parseResponseInfoPayload(data) ?? parseResponseInfoPayload(error) ?? undefined;
      if (nested) {
        responseInfo = nested;
      }

      let payload: AdEventPayload<EventType>;
      if (error) {
        payload = adErrorFromNativeEvent(
          error,
          'googleMobileAds',
          'show',
        ) as AdEventPayload<EventType>;
      } else if (data && typeof data === 'object' && 'responseInfo' in data) {
        const rest = { ...(data as Record<string, unknown>) };
        delete rest.responseInfo;
        payload = (Object.keys(rest).length > 0 ? rest : undefined) as AdEventPayload<EventType>;
      } else {
        payload = data as AdEventPayload<EventType>;
      }

      adEventsListeners.forEach(listener => {
        listener({ type, payload });
      });
      adEventListenersMap.get(type)?.forEach(listener => {
        listener(payload);
      });
    },
  );

  const pooled = {
    format: options.format,
    adId,
    observedAt: options.observedAt,
    provenance: 'pool/sdk-managed-preloader' as const,
    stalenessWindowMillis: expiry.stalenessWindowMillis,
    stalenessWindowSource: expiry.stalenessWindowSource,
    isStaleByPolicy: () => expiry.isStaleByPolicy(),
    onStaleByPolicy: (listener: () => void) => expiry.onStaleByPolicy(listener),
    get responseInfo() {
      return responseInfo;
    },
    show(showOptions?: AdShowOptions): Promise<void> {
      if (destroyed) {
        return Promise.reject(new Error('PooledAd.show() ad has been destroyed.'));
      }
      if (showRequested) {
        return Promise.reject(new Error('PooledAd.show() Show has already been requested.'));
      }
      const validated = validateAdShowOptions(showOptions);
      showRequested = true;
      return bridge.show(options.requestId, options.adUnitId, validated);
    },
    addAdEventListener<T extends EventType>(type: T, listener: AdEventListener<T>): () => void {
      if (destroyed) {
        throw new Error('PooledAd.addAdEventListener(*) ad has been destroyed.');
      }
      if (
        !(
          isOneOf(type, Object.values(AdEventType)) ||
          isOneOf(type, Object.values(GAMAdEventType)) ||
          (isOneOf(type, Object.values(RewardedAdEventType)) &&
            (options.format === AdFormat.REWARDED ||
              options.format === AdFormat.REWARDED_INTERSTITIAL))
        )
      ) {
        throw new Error("PooledAd.addAdEventListener(*) 'type' expected a valid event type value.");
      }
      if (!isFunction(listener)) {
        throw new Error("PooledAd.addAdEventListener(_, *) 'listener' expected a function.");
      }
      const id = adEventListenerId++;
      const listeners = adEventListenersMap.get(type);
      if (!listeners) {
        throw new Error('PooledAd.addAdEventListener(*) unknown event type map');
      }
      listeners.set(id, listener as AdEventListener<EventType>);
      return () => {
        listeners.delete(id);
      };
    },
    addAdEventsListener<T extends EventType>(listener: AdEventsListener<T>): () => void {
      if (destroyed) {
        throw new Error('PooledAd.addAdEventsListener(*) ad has been destroyed.');
      }
      if (!isFunction(listener)) {
        throw new Error("PooledAd.addAdEventsListener(*) 'listener' expected a function.");
      }
      const id = adEventsListenerId++;
      adEventsListeners.set(id, listener as AdEventsListener<EventType>);
      return () => {
        adEventsListeners.delete(id);
      };
    },
    removeAllListeners(): void {
      adEventsListeners.clear();
      adEventListenersMap.forEach((_, type, map) => {
        map.set(type, new Map());
      });
    },
    destroy(): void {
      if (destroyed) {
        return;
      }
      destroyed = true;
      nativeListener.remove();
      adEventsListeners.clear();
      adEventListenersMap.forEach((_, type, map) => {
        map.set(type, new Map());
      });
      expiry.clear();
      bridge.destroy(options.requestId);
    },
  };

  return pooled as Extract<PooledAd, { show: (opts?: AdShowOptions) => Promise<void> }>;
}

export { allocateFullscreenRequestId };
