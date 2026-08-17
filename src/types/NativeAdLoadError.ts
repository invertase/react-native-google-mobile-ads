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

/**
 * Error shape rejected by {@link NativeAd.createForAdRequest} when the native ad request fails.
 *
 * Both Android and iOS reject with `code: 'ERROR_LOAD'`. The `message` carries the underlying
 * SDK / platform failure text (for example no fill, invalid request, or a missing response ID).
 *
 * `userInfo` is platform-dependent and may be absent. Do not rely on a fixed nested shape.
 */
export interface NativeAdLoadError {
  code: 'ERROR_LOAD';
  message: string;
  userInfo?: Readonly<Record<string, unknown>> | null;
}
