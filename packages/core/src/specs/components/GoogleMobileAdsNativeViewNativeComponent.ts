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
import codegenNativeComponent from 'react-native/Libraries/Utilities/codegenNativeComponent';
import codegenNativeCommands from 'react-native/Libraries/Utilities/codegenNativeCommands';
import type { Int32 } from 'react-native/Libraries/Types/CodegenTypes';

export interface NativeProps extends ViewProps {
  responseId: string;
}

type NativeViewComponentType = HostComponent<NativeProps>;

interface NativeCommands {
  registerAsset: (
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- https://github.com/facebook/react-native/issues/54272
    viewRef: React.ElementRef<NativeViewComponentType>,
    assetType: string,
    reactTag: Int32,
  ) => void;
}

export const Commands: NativeCommands = codegenNativeCommands<NativeCommands>({
  supportedCommands: ['registerAsset'],
});

export default codegenNativeComponent<NativeProps>(
  'RNGoogleMobileAdsNativeView',
) as NativeViewComponentType;
