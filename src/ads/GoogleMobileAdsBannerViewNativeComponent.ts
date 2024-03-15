import type * as React from 'react';
import type { HostComponent, ViewProps } from 'react-native';
import type { BubblingEventHandler, Float } from 'react-native/Libraries/Types/CodegenTypes';
import codegenNativeComponent from 'react-native/Libraries/Utilities/codegenNativeComponent';
import codegenNativeCommands from 'react-native/Libraries/Utilities/codegenNativeCommands';

export type NativeEvent = {
  type: string;
  width?: Float;
  height?: Float;
  code?: string;
  message?: string;
  name?: string;
  data?: string;
  currency?: string;
  precision?: Float;
  value?: Float;
};

export interface NativeProps extends ViewProps {
  sizes: string[];
  unitId: string;
  request: string;
  manualImpressionsEnabled: boolean;
  onNativeEvent: BubblingEventHandler<NativeEvent>;
}

export type ComponentType = HostComponent<NativeProps>;

interface NativeCommands {
  recordManualImpression: (viewRef: React.ElementRef<ComponentType>) => void;
}

export const Commands: NativeCommands = codegenNativeCommands<NativeCommands>({
  supportedCommands: ['recordManualImpression'],
});

export default codegenNativeComponent<NativeProps>(
  'RNGoogleMobileAdsBannerView',
) as HostComponent<NativeProps>;
