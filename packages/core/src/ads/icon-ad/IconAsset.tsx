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
import { IconAdContext } from './IconAdContext';
import { Commands } from '../../specs/components/GoogleMobileAdsIconAdViewNativeComponent';
import { composeRefs, getElementRef } from '../../common/ref';

export enum IconAssetType {
  HEADLINE = 'headline',
  CALL_TO_ACTION = 'callToAction',
  ICON = 'icon',
  STAR_RATING = 'starRating',
  AD_CHOICES = 'adChoices',
}

export type IconAssetProps = {
  assetType: IconAssetType;
  children: ReactElement;
};

export const IconAsset = (props: IconAssetProps) => {
  const { assetType, children } = props;
  const ctx = useContext(IconAdContext);
  const requestId = ctx?.iconAd.requestId;
  const ref = useRef<React.Component>(null);

  useEffect(() => {
    if (!ctx?.viewRef.current) {
      return;
    }
    const reactTag = findNodeHandle(ref.current);
    if (reactTag) {
      Commands.registerAsset(ctx.viewRef.current, assetType, reactTag);
    }
  }, [ctx?.viewRef, assetType, requestId]);

  if (!React.isValidElement(children)) {
    return null;
  }

  const childrenRef = getElementRef(children);
  return React.cloneElement(children, {
    // @ts-ignore
    ref: composeRefs(ref, childrenRef),
  }) as ReactElement;
};
