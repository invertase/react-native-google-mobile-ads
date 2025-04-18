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

import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';
import type { UnsafeObject } from 'react-native/Libraries/Types/CodegenTypes';

import { AdapterStatus } from '../../types';

export interface Spec extends TurboModule {
  readonly getConstants: () => {
    REVENUE_PRECISION_ESTIMATED: number;
    REVENUE_PRECISION_PRECISE: number;
    REVENUE_PRECISION_PUBLISHER_PROVIDED: number;
    REVENUE_PRECISION_UNKNOWN: number;
  };

  initialize(): Promise<AdapterStatus[]>;
  setRequestConfiguration(requestConfiguration?: UnsafeObject): Promise<void>;
  openAdInspector(): Promise<void>;
  openDebugMenu(adUnit: string): void;
  setAppVolume(volume: number): void;
  setAppMuted(muted: boolean): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('RNGoogleMobileAdsModule');
