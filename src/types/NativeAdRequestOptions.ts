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

import { RequestOptions } from './RequestOptions';

export enum NativeMediaAspectRatio {
  ANY = 1,
  LANDSCAPE = 2,
  PORTRAIT = 3,
  SQUARE = 4,
}

export enum NativeAdChoicesPlacement {
  TOP_LEFT = 0,
  TOP_RIGHT = 1,
  BOTTOM_RIGHT = 2,
  BOTTOM_LEFT = 3,
}

export interface NativeAdRequestOptions extends RequestOptions {
  /**
   * Specifies a preference for the aspect ratio of ad creatives.
   * Setting this option does not guarantee that all ad creatives will meet the preference specified.
   * - When unset, the returned ad can have any media aspect ratio.
   * - When set, you will be able to improve the user experience by specifying the preferred type of aspect ratio.
   */
  aspectRatio?: NativeMediaAspectRatio;
  /**
   * Chooses which corner to render the AdChoices icon.
   * - If unset, the AdChoices icon position is set to the top right.
   * - If set, AdChoices is placed at the custom position as requested.
   */
  adChoicesPlacement?: NativeAdChoicesPlacement;
  /**
   * Disables or enables a video's starting audio.
   * - The start muted behavior is enabled by default.
   * - When disabled, your app requests the video should begin with audio.
   * - When enabled, your app requests that the video should begin with audio muted.
   */
  startVideoMuted?: boolean;
}
