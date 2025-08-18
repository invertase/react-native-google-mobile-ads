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

import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';
import type { Double, Float, UnsafeObject } from 'react-native/Libraries/Types/CodegenTypes';

export type NativeAdProps = {
  responseId: string;
  advertiser: string | null;
  body: string;
  callToAction: string;
  headline: string;
  price: string | null;
  store: string | null;
  starRating: Double | null;
  icon: NativeAdImage | null;
  images: Array<NativeAdImage> | null;
  mediaContent: NativeMediaContent;
  extras: UnsafeObject | null;
};

export type NativeAdImage = {
  url: string;
  scale: Double;
};

export type NativeMediaContent = {
  aspectRatio: Float;
  hasVideoContent: boolean;
  duration: Float;
};

export type NativeAdEventPayload = {
  responseId: string;
  type: string;
};

export interface Spec extends TurboModule {
  load(adUnitId: string, requestOptions: UnsafeObject): Promise<NativeAdProps>;
  destroy(responseId: string): void;
  // Codegen EventEmitter was introduced in RN 0.76.2, so we can't apply it for now, due to backward compatibility.
  // readonly onAdEvent: EventEmitter<NativeAdEventPayload>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('RNGoogleMobileAdsNativeModule');
