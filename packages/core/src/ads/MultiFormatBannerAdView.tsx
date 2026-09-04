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

import React from 'react';
import type { ViewProps } from 'react-native';

import GoogleMobileAdsMultiFormatBannerViewNativeComponent from '../specs/components/GoogleMobileAdsMultiFormatBannerViewNativeComponent';
import { AdFormat } from '../types/AdFormat';
import type { MultiFormatAdHandle } from '../types/MultiFormatAd';

export type MultiFormatBannerAdHandle = Extract<MultiFormatAdHandle, { format: AdFormat.BANNER }>;

export type MultiFormatBannerAdViewProps = ViewProps & {
  /**
   * Banner handle from `MultiFormatAdRequest.load()` / `useMultiFormatAd`.
   * Attach-only: must not issue a second ad request.
   * Typed as banner-only: non-banner handles are a compile-time error.
   *
   * The `AdFormat.BANNER` arm of `PooledAd` is structurally identical, so a
   * polled banner can be passed here directly. Both arms carry `AdIdentity`,
   * `AdExpiry`, and a provenance tag.
   */
  handle: MultiFormatBannerAdHandle;
};

/**
 * Renders a multi-format request banner handle.
 *
 * Attach-only: the handle already owns the loaded inventory. Pass the handle
 * once; double-attach is rejected by the hooks that own destruction.
 */
export function MultiFormatBannerAdView({
  handle,
  style,
  ...viewProps
}: MultiFormatBannerAdViewProps): React.JSX.Element {
  return (
    <GoogleMobileAdsMultiFormatBannerViewNativeComponent
      {...viewProps}
      handleId={handle.adId}
      style={[{ width: handle.size.width, height: handle.size.height }, style]}
    />
  );
}
