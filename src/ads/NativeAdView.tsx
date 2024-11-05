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

import React, {
  createContext,
  ReactElement,
  RefObject,
  useContext,
  useEffect,
  useRef,
} from 'react';
import { findNodeHandle, ViewProps } from 'react-native';
import { NativeAd } from './NativeAd';
import GoogleMobileAdsNativeView, {
  Commands,
} from '../specs/components/GoogleMobileAdsNativeViewNativeComponent';

export type NativeAdViewProps = ViewProps & {
  nativeAd: NativeAd;
};

type NativeAdContextType = {
  nativeAd: NativeAd;
  viewRef: RefObject<React.ElementRef<typeof GoogleMobileAdsNativeView>>;
};
const NativeAdContext = createContext<NativeAdContextType>({} as NativeAdContextType);

export const NativeAdView = (props: NativeAdViewProps) => {
  const { nativeAd, children, ...viewProps } = props;
  const ref = useRef<React.ElementRef<typeof GoogleMobileAdsNativeView>>(null);
  return (
    <GoogleMobileAdsNativeView {...viewProps} ref={ref} responseId={nativeAd.responseId}>
      <NativeAdContext.Provider value={{ nativeAd, viewRef: ref }}>
        {children}
      </NativeAdContext.Provider>
    </GoogleMobileAdsNativeView>
  );
};

export type NativeAssetProps = { assetKey: string; children: ReactElement };

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

// Access the ref using the method that doesn't yield a warning.
function getElementRef(element: React.ReactElement) {
  // React <=18 in DEV
  let getter = Object.getOwnPropertyDescriptor(element.props, 'ref')?.get;
  let mayWarn = getter && 'isReactWarning' in getter && getter.isReactWarning;
  if (mayWarn) {
    return (element as any).ref;
  }

  // React 19 in DEV
  getter = Object.getOwnPropertyDescriptor(element, 'ref')?.get;
  mayWarn = getter && 'isReactWarning' in getter && getter.isReactWarning;
  if (mayWarn) {
    return element.props.ref;
  }

  // Not DEV
  return element.props.ref || (element as any).ref;
}

type PossibleRef<T> = React.Ref<T> | undefined;

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
