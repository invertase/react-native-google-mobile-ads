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
 * Convenience identifiers for `RequestConfiguration.testDeviceIdentifiers`.
 *
 * Emulators and simulators are already treated as test devices by the Google
 * Mobile Ads SDK on iOS and Android (classic and Next-Gen). Prefer those
 * automatic detections over listing identifiers unless you need the classic
 * Android `EMULATOR` alias below.
 *
 * For physical devices, pass the hashed device id that the SDK prints to
 * logcat / Xcode when an ad is requested (the log line mentions
 * `RequestConfiguration.Builder.setTestDeviceIds`).
 */
export const TestDeviceIds = {
  /**
   * Classic Android only: maps to `AdRequest.DEVICE_ID_EMULATOR`.
   * Unnecessary on iOS and on Android Next-Gen (emulators are auto-detected;
   * Next-Gen strips this alias before calling the SDK).
   */
  EMULATOR: 'EMULATOR',
} as const;
