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

import { Platform } from 'react-native';

export const TestIds = {
  APP_OPEN: '',
  BANNER: '',
  INTERSTITIAL: '',
  REWARDED: '',
  REWARDED_INTERSTITIAL: '',
  GAM_APP_OPEN: '/6499/example/app-open',
  GAM_BANNER: '/6499/example/banner',
  GAM_INTERSTITIAL: '/6499/example/interstitial',
  GAM_REWARDED: '/6499/example/rewarded',
  GAM_REWARDED_INTERSTITIAL: '/21775744923/example/rewarded_interstitial',
  GAM_NATIVE: '/6499/example/native',
  ...Platform.select({
    android: {
      APP_OPEN: 'ca-app-pub-3940256099942544/9257395921',
      ADAPTIVE_BANNER: 'ca-app-pub-3940256099942544/9214589741',
      BANNER: 'ca-app-pub-3940256099942544/6300978111',
      INTERSTITIAL: 'ca-app-pub-3940256099942544/1033173712',
      INTERSTITIAL_VIDEO: 'ca-app-pub-3940256099942544/8691691433',
      REWARDED: 'ca-app-pub-3940256099942544/5224354917',
      REWARDED_INTERSTITIAL: 'ca-app-pub-3940256099942544/5354046379',
    },
    ios: {
      APP_OPEN: 'ca-app-pub-3940256099942544/5575463023',
      ADAPTIVE_BANNER: 'ca-app-pub-3940256099942544/2435281174',
      BANNER: 'ca-app-pub-3940256099942544/2934735716',
      INTERSTITIAL: 'ca-app-pub-3940256099942544/4411468910',
      INTERSTITIAL_VIDEO: 'ca-app-pub-3940256099942544/5135589807',
      REWARDED: 'ca-app-pub-3940256099942544/1712485313',
      REWARDED_INTERSTITIAL: 'ca-app-pub-3940256099942544/6978759866',
    },
  }),
};
