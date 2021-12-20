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
 * AdsConsentStatus enum.
 */
export enum AdsConsentStatus {
  /**
   * The consent status is unknown and the user must provide consent to show ads if they are within the EEA or location is also unknown.
   */
  UNKNOWN = 0,

  /**
   * The user has accepted non-personalized ads.
   */
  NON_PERSONALIZED = 1,

  /**
   * The user has accepted personalized ads.
   */
  PERSONALIZED = 2,
}
