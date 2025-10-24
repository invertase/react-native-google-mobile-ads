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
  sizeConfig: { sizes: string[]; maxHeight?: Float; width?: Float };
  unitId: string;
  request: string;
  manualImpressionsEnabled: boolean;
  onNativeEvent: BubblingEventHandler<NativeEvent>;
}

export type ComponentType = HostComponent<NativeProps>;

interface NativeCommands {
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- https://github.com/facebook/react-native/issues/54272
  recordManualImpression: (viewRef: React.ElementRef<ComponentType>) => void;
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- https://github.com/facebook/react-native/issues/54272
  load: (viewRef: React.ElementRef<ComponentType>) => void;
}

// SyntaxError "'Commands' is a reserved export and may only be used to export the result of codegenNativeCommands"
// @ts-ignore -- migration to react-native 0.73+
export const Commands: NativeCommands = codegenNativeCommands<NativeCommands>({
  supportedCommands: ['recordManualImpression', 'load'],
});

export default codegenNativeComponent<NativeProps>(
  'RNGoogleMobileAdsBannerView',
) as HostComponent<NativeProps>;
