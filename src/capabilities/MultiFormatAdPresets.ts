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
import type { MultiFormatAdRequestOptions } from '../types/MultiFormatAd';
import type { MultiFormatBannerSize } from '../types/MultiFormatBannerSize';

/**
 * Multi-format request presets. Return plain `MultiFormatAdRequestOptions`, so
 * they drop straight into the `requestOptions` slot of a `MultiFormatAdConfig`
 * and the ad unit stays at the top level beside it.
 */
export const MultiFormatAdPresets = {
  nativeOrBanner(bannerSizes: MultiFormatBannerSize[]): MultiFormatAdRequestOptions {
    return {
      formats: [AdFormat.NATIVE, AdFormat.BANNER],
      bannerSizes,
      requestCount: 1,
      adServer: 'ad-manager',
    };
  },
} as const;
