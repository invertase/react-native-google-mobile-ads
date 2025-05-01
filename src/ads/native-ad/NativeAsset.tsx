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

import React, { ReactElement, useContext, useEffect, useRef } from 'react';
import { findNodeHandle } from 'react-native';
import { NativeAdContext } from './NativeAdContext';
import { Commands } from '../../specs/components/GoogleMobileAdsNativeViewNativeComponent';
import { composeRefs, getElementRef } from '../../common/ref';

export enum NativeAssetType {
  ADVERTISER = 'advertiser',
  BODY = 'body',
  CALL_TO_ACTION = 'callToAction',
  HEADLINE = 'headline',
  PRICE = 'price',
  STORE = 'store',
  STAR_RATING = 'starRating',
  ICON = 'icon',
  IMAGE = 'image',
}

export type NativeAssetProps = {
  assetType: NativeAssetType;
  children: ReactElement;
};

export const NativeAsset = (props: NativeAssetProps) => {
  const { assetType, children } = props;
  const { viewRef } = useContext(NativeAdContext);
  const ref = useRef<React.Component>(null);

  useEffect(() => {
    if (!viewRef.current) {
      return;
    }
    const node = ref.current;
    const reactTag = findNodeHandle(node);
    if (reactTag) {
      Commands.registerAsset(viewRef.current, assetType, reactTag);
    }
  }, [viewRef]);

  if (!React.isValidElement(children)) {
    return null;
  }

  const childrenRef = getElementRef(children);
  return React.cloneElement(children, {
    // @ts-ignore
    ref: composeRefs(ref, childrenRef),
  }) as ReactElement;
};
