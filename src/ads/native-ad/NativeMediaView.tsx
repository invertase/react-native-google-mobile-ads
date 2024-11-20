import React, { useContext } from 'react';
import { ViewProps } from 'react-native';
import GoogleMobileAdsMediaView from '../../specs/components/GoogleMobileAdsMediaViewNativeComponent';
import { NativeAsset } from './NativeAsset';
import { NativeAdContext } from './NativeAdContext';

export type NativeMediaViewProps = ViewProps;

export const NativeMediaView = (props: NativeMediaViewProps) => {
  const { style, ...viewProps } = props;
  const { nativeAd } = useContext(NativeAdContext);
  const { responseId, mediaContent } = nativeAd;

  return (
    // @ts-ignore
    <NativeAsset assetKey={'media'}>
      <GoogleMobileAdsMediaView
        {...viewProps}
        responseId={responseId}
        style={[{ aspectRatio: mediaContent?.aspectRatio }, style]}
      />
    </NativeAsset>
  );
};
