import { NativeAd } from './NativeAd';
import React, { createContext, RefObject } from 'react';
import type GoogleMobileAdsNativeView from '../../specs/components/GoogleMobileAdsNativeViewNativeComponent';

type NativeAdContextType = {
  nativeAd: NativeAd;
  viewRef: RefObject<React.ElementRef<typeof GoogleMobileAdsNativeView>>;
};
export const NativeAdContext = createContext<NativeAdContextType>({} as NativeAdContextType);
