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

import { AdFormat } from '../types/AdFormat';
import type { CapabilitySupport } from '../types/CapabilitySupport';
import type { AdCapabilities } from '../types/AdCapabilities';

const unavailable: CapabilitySupport = 'unavailable';

const STUB_CAPABILITIES: AdCapabilities = {
  backend: 'android-classic',
  sdkVersion: '0.0.0-stub',
  formats: {
    [AdFormat.APP_OPEN]: unavailable,
    [AdFormat.INTERSTITIAL]: unavailable,
    [AdFormat.REWARDED]: unavailable,
    [AdFormat.REWARDED_INTERSTITIAL]: unavailable,
    [AdFormat.BANNER]: unavailable,
    [AdFormat.NATIVE]: unavailable,
  },
  multiFormatNativeBanner: unavailable,
  fullscreenPreload: unavailable,
  fullscreenPreloadFormats: {
    [AdFormat.APP_OPEN]: unavailable,
    [AdFormat.INTERSTITIAL]: unavailable,
    [AdFormat.REWARDED]: unavailable,
    [AdFormat.REWARDED_INTERSTITIAL]: unavailable,
  },
  displayPreload: unavailable,
  multiCountNative: unavailable,
  // Stub backend is android-classic: no peek API on that surface.
  poolResponseInfoPeek: unavailable,
  // Server-delivered cap: any concrete number would be a guess.
  maxManagedPoolAds: null,
  mediation: 'unknown',
};

/**
 * Returns the static capability snapshot for this binary.
 * Stub: placeholder values (`android-classic`, `0.0.0-stub`, all `unavailable`,
 * including `poolResponseInfoPeek`) until native wiring lands, not live
 * capability readings.
 */
export function getAdCapabilities(): AdCapabilities {
  return STUB_CAPABILITIES;
}
