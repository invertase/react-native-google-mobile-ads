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

import NativeGoogleMobileAdsModule from '../specs/modules/NativeGoogleMobileAdsModule';
import { AdFormat } from '../types/AdFormat';
import type { AdBackend } from '../types/AdBackend';
import type { CapabilitySupport } from '../types/CapabilitySupport';
import type { AdCapabilities } from '../types/AdCapabilities';

const supported: CapabilitySupport = 'supported';
const experimental: CapabilitySupport = 'experimental';
const unavailable: CapabilitySupport = 'unavailable';
const emulated: CapabilitySupport = 'emulated';

/**
 * Returns the static capability snapshot for this binary.
 *
 * Classic fullscreen preload is experimental (iOS Beta / Android limited-alpha).
 * Android classic has no rewarded-interstitial preloader and no peek API.
 * Android next-gen wires AppOpen/Interstitial/Rewarded preloaders + peek; RWI and
 * display preload remain unavailable / library-emulated.
 * `maxManagedPoolAds` stays null (server-delivered; documented default is 6).
 */
export function getAdCapabilities(): AdCapabilities {
  const { sdkVersion, backend: backendRaw } = NativeGoogleMobileAdsModule.getConstants();
  const backend = backendRaw as AdBackend;
  const isIos = backend === 'ios';
  const isAndroidNextGen = backend === 'android-next-gen';

  const classicFullscreen: CapabilitySupport = experimental;
  const nextGenFullscreen: CapabilitySupport = supported;
  const fullscreenPreload = isAndroidNextGen ? nextGenFullscreen : classicFullscreen;
  const fullscreenFormatSupport = fullscreenPreload;
  // Android classic and next-gen both lack RewardedInterstitialAdPreloader.
  const rewardedInterstitialPreload: CapabilitySupport = isIos ? experimental : unavailable;

  return {
    backend,
    sdkVersion,
    formats: {
      [AdFormat.APP_OPEN]: supported,
      [AdFormat.INTERSTITIAL]: supported,
      [AdFormat.REWARDED]: supported,
      [AdFormat.REWARDED_INTERSTITIAL]: supported,
      [AdFormat.BANNER]: supported,
      [AdFormat.NATIVE]: supported,
    },
    multiFormatNativeBanner: supported,
    fullscreenPreload,
    fullscreenPreloadFormats: {
      [AdFormat.APP_OPEN]: fullscreenFormatSupport,
      [AdFormat.INTERSTITIAL]: fullscreenFormatSupport,
      [AdFormat.REWARDED]: fullscreenFormatSupport,
      [AdFormat.REWARDED_INTERSTITIAL]: rewardedInterstitialPreload,
    },
    // NG-2 did not wire native display preloaders; keep library-emulated depth-1.
    displayPreload: emulated,
    multiCountNative: unavailable,
    poolResponseInfoPeek: isIos || isAndroidNextGen ? supported : unavailable,
    maxManagedPoolAds: null,
    mediation: 'unknown',
  };
}
