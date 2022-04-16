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
 *
 *
 *
 * The definitions in this document are copied from IAB's global vendor list.
 *
 *   https://vendor-list.consensu.org/v2/vendor-list.json
 *   https://github.com/InteractiveAdvertisingBureau/GDPR-Transparency-and-Consent-Framework
 *
 */

export enum AdsConsentSpecialFeatures {
  /**
   * Your precise geolocation data can be used in support of one or more purposes.
   * This means your location can be accurate to within several meters.
   *
   * Vendors can:
   *   - Collect and process precise geolocation data in support of one or more purposes.
   *   - Precise geolocation means that there are no restrictions on the precision of
   *     a user's location; this can be accurate to within several meters.
   */
  USE_PRECISE_GEOLOCATION_DATA = 1,

  /**
   * Your device can be identified based on a scan of your device's
   * unique combination of characteristics.
   *
   * Vendors can:
   *   - Create an identifier using data collected via actively scanning a device for
   *     specific characteristics, e.g. installed fonts or screen resolution.
   *   - Use such an identifier to re-identify a device.
   */
  ACTIVELY_SCAN_DEVICE_CHARACTERISTICS_FOR_IDENTIFICATION = 2,
}
