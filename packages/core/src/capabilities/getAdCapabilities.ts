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

import { Platform } from 'react-native';

import { AdFormat } from '../types/AdFormat';
import type { CapabilitySupport } from '../types/CapabilitySupport';
import type { AdCapabilities } from '../types/AdCapabilities';

const supported: CapabilitySupport = 'supported';
const experimental: CapabilitySupport = 'experimental';
const unavailable: CapabilitySupport = 'unavailable';

/** Pinned linked SDK versions from package.json sdkVersions (exact pins). */
const SDK_VERSION = {
  ios: '13.5.0',
  android: '25.4.0',
} as const;

/**
 * Returns the static capability snapshot for this binary.
 *
 * Classic fullscreen preload is experimental (iOS Beta / Android limited-alpha).
 * Android classic has no rewarded-interstitial preloader and no peek API.
 * Display preload stays unavailable until emulated pools (FEAT-06).
 * `maxManagedPoolAds` stays null (server-delivered; documented default is 6).
 */
export function getAdCapabilities(): AdCapabilities {
  const isIos = Platform.OS === 'ios';
  const backend = isIos ? 'ios' : 'android-classic';

  return {
    backend,
    sdkVersion: isIos ? SDK_VERSION.ios : SDK_VERSION.android,
    formats: {
      [AdFormat.APP_OPEN]: supported,
      [AdFormat.INTERSTITIAL]: supported,
      [AdFormat.REWARDED]: supported,
      [AdFormat.REWARDED_INTERSTITIAL]: supported,
      [AdFormat.BANNER]: supported,
      [AdFormat.NATIVE]: supported,
    },
    multiFormatNativeBanner: supported,
    fullscreenPreload: experimental,
    fullscreenPreloadFormats: {
      [AdFormat.APP_OPEN]: experimental,
      [AdFormat.INTERSTITIAL]: experimental,
      [AdFormat.REWARDED]: experimental,
      // Android classic has no RewardedInterstitialAdPreloader.
      [AdFormat.REWARDED_INTERSTITIAL]: isIos ? experimental : unavailable,
    },
    displayPreload: unavailable,
    multiCountNative: unavailable,
    poolResponseInfoPeek: isIos ? supported : unavailable,
    maxManagedPoolAds: null,
    mediation: 'unknown',
  };
}
