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

import React, { useRef } from 'react';
import { ViewProps } from 'react-native';
import { NativeAd } from './NativeAd';
import { NativeAdContext } from './NativeAdContext';
import GoogleMobileAdsNativeView from '../../specs/components/GoogleMobileAdsNativeViewNativeComponent';

export type NativeAdViewProps = ViewProps & {
  nativeAd: NativeAd;
};

export const NativeAdView = (props: NativeAdViewProps) => {
  const { nativeAd, children, ...viewProps } = props;
  const ref = useRef<React.ComponentRef<typeof GoogleMobileAdsNativeView>>(null);
  return (
    <GoogleMobileAdsNativeView
      {...viewProps}
      ref={ref}
      responseId={nativeAd.responseId}
      removeClippedSubviews={false}
    >
      <NativeAdContext.Provider value={{ nativeAd, viewRef: ref }}>
        {children}
      </NativeAdContext.Provider>
    </GoogleMobileAdsNativeView>
  );
};
