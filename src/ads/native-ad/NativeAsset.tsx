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

export type NativeAssetProps = { assetKey: NativeAssetType; children: ReactElement };

export const NativeAsset = (props: NativeAssetProps) => {
  const { assetKey, children } = props;
  const { viewRef } = useContext(NativeAdContext);
  const ref = useRef(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || !viewRef.current) {
      return;
    }
    const reactTag = findNodeHandle(node);
    if (reactTag) {
      Commands.registerAsset(viewRef.current, assetKey, reactTag);
    }
    // TODO: unregister asset in cleanup?
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

type PossibleRef<T> = React.Ref<T> | undefined;
interface ElementWithRef extends React.ReactElement {
  ref?: PossibleRef<unknown>;
}

/**
 * Access the ref using the method that doesn't yield a warning.
 *
 * Before React 19 accessing `element.props.ref` will throw a warning and suggest using `element.ref`
 * After React 19 accessing `element.ref` does the opposite.
 * https://github.com/facebook/react/pull/28348
 */
function getElementRef(element: React.ReactElement): PossibleRef<unknown> {
  // React <=18 in DEV
  let getter = Object.getOwnPropertyDescriptor(element.props, 'ref')?.get;
  let mayWarn = getter && 'isReactWarning' in getter && getter.isReactWarning;
  if (mayWarn) {
    return (element as ElementWithRef).ref;
  }

  // React 19 in DEV
  getter = Object.getOwnPropertyDescriptor(element, 'ref')?.get;
  mayWarn = getter && 'isReactWarning' in getter && getter.isReactWarning;
  if (mayWarn) {
    return element.props.ref;
  }

  // Not DEV
  return element.props.ref || (element as ElementWithRef).ref;
}

function composeRefs<T>(...refs: PossibleRef<T>[]) {
  return (value: T) => {
    refs.forEach(ref => {
      if (typeof ref === 'function') {
        ref(value);
      } else if (ref !== null && ref !== undefined) {
        (ref as React.MutableRefObject<T>).current = value;
      }
    });
  };
}
