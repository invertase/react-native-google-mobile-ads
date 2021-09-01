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

import { createModuleNamespace, Module } from './internal';
import AdEventType from './AdEventType';
import AdsConsentDebugGeography from './AdsConsentDebugGeography';
import AdsConsentStatus from './AdsConsentStatus';
import MaxAdContentRating from './MaxAdContentRating';
import RewardedAdEventType from './RewardedAdEventType';
import BannerAdSize from './BannerAdSize';
import TestIds from './TestIds';
import validateAdRequestConfiguration from './validateAdRequestConfiguration';
import version from './version';

const statics = {
  AdsConsentDebugGeography,
  AdsConsentStatus,
  AdEventType,
  RewardedAdEventType,
  MaxAdContentRating,
  TestIds,
  BannerAdSize,
};

const namespace = 'admob';

const nativeModuleName = ['AdMobModule', 'AdMobInterstitialModule', 'AdMobRewardedModule'];

class AdMobModule extends Module {
  constructor(...args) {
    super(...args);

    this.emitter.addListener('interstitial_event', event => {
      this.emitter.emit(`interstitial_event:${event.adUnitId}:${event.requestId}`, event);
    });

    this.emitter.addListener('rewarded_event', event => {
      this.emitter.emit(`rewarded_event:${event.adUnitId}:${event.requestId}`, event);
    });
  }

  setRequestConfiguration(requestConfiguration) {
    let config;
    try {
      config = validateAdRequestConfiguration(requestConfiguration);
    } catch (e) {
      throw new Error(`admob.setRequestConfiguration(*) ${e.message}`);
    }

    return this.native.setRequestConfiguration(config);
  }
}

// import { SDK_VERSION } from '@invertase/react-native-firebase/admob';
export const SDK_VERSION = version;

export default new AdMobModule();

export { default as AdsConsentDebugGeography } from './AdsConsentDebugGeography';
export { default as AdsConsentStatus } from './AdsConsentStatus';
export { default as MaxAdContentRating } from './MaxAdContentRating';
export { default as TestIds } from './TestIds';
export { default as AdEventType } from './AdEventType';
export { default as BannerAdSize } from './BannerAdSize';
export { default as RewardedAdEventType } from './RewardedAdEventType';
export { default as AdsConsent } from './AdsConsent';
export { default as InterstitialAd } from './ads/InterstitialAd';
export { default as RewardedAd } from './ads/RewardedAd';
export { default as BannerAd } from './ads/BannerAd';
