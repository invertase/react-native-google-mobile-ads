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

import React, { useContext } from 'react';
import { ViewProps } from 'react-native';
import GoogleMobileAdsMediaView from '../../specs/components/GoogleMobileAdsMediaViewNativeComponent';
import { NativeAsset } from './NativeAsset';
import { NativeAdContext } from './NativeAdContext';

export type NativeMediaViewProps = ViewProps & {
  resizeMode?: 'cover' | 'contain' | 'stretch';
};

export const NativeMediaView = (props: NativeMediaViewProps) => {
  const { resizeMode, style, ...viewProps } = props;
  const { nativeAd } = useContext(NativeAdContext);
  const { responseId, mediaContent } = nativeAd;

  return (
    // @ts-ignore
    <NativeAsset assetType={'media'}>
      <GoogleMobileAdsMediaView
        {...viewProps}
        responseId={responseId}
        resizeMode={resizeMode}
        style={[{ aspectRatio: mediaContent?.aspectRatio }, style]}
      />
    </NativeAsset>
  );
};
