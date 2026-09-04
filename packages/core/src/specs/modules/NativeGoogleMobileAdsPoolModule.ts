/**
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

import { TurboModule, TurboModuleRegistry } from 'react-native';
import type { UnsafeObject } from 'react-native/Libraries/Types/CodegenTypes';

export type PoolStartResult = {
  started: boolean;
  effectiveBufferSize: number;
};

export type PoolAvailabilityResult = {
  available: boolean;
  observedCount: number;
};

export type PoolPollResult = {
  filled: boolean;
  requestId?: number;
  responseId?: string | null;
  responseInfo?: UnsafeObject | null;
};

export interface Spec extends TurboModule {
  poolStart(
    preloadId: string,
    format: string,
    adUnitId: string,
    bufferSize: number,
    requestOptions: UnsafeObject,
  ): Promise<PoolStartResult>;

  poolGetAvailability(preloadId: string, format: string): Promise<PoolAvailabilityResult>;

  poolPeekResponseInfo(preloadId: string, format: string): Promise<UnsafeObject | null>;

  poolPoll(
    preloadId: string,
    format: string,
    requestId: number,
    adUnitId: string,
  ): Promise<PoolPollResult>;

  poolDestroy(preloadId: string, format: string): void;

  addListener(eventName: string): void;
  removeListeners(count: number): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('RNGoogleMobileAdsPoolModule');
