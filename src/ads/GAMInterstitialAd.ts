import { AdEventType } from '../AdEventType';
import { GAMAdEventType } from '../GAMAdEventType';
import { AdEventListener } from '../types/AdEventListener';
import { AdEventsListener } from '../types/AdEventsListener';
import { RequestOptions } from '../types/RequestOptions';
import { InterstitialAd } from './InterstitialAd';

export class GAMInterstitialAd extends InterstitialAd {
  /**
   * Creates a new GAMInterstitialAd instance.
   *
   * #### Example
   *
   * ```js
   * import { GAMInterstitialAd, AdEventType, TestIds } from 'react-native-google-mobile-ads';
   *
   * const interstitialAd = await GAMInterstitialAd.createForAdRequest(TestIds.GAM_INTERSTITIAL, {
   *   requestAgent: 'CoolAds',
   * });
   *
   * interstitialAd.addAdEventListener(AdEventType.Loaded, () => {
   *   interstitialAd.show();
   * });
   *
   * interstitialAd.load();
   * ```
   *
   * @param adUnitId The Ad Unit ID for the Interstitial. You can find this on your Google Mobile Ads dashboard.
   * @param requestOptions Optional RequestOptions used to load the ad.
   */
  static createForAdRequest(adUnitId: string, requestOptions?: RequestOptions) {
    return super.createForAdRequest(adUnitId, requestOptions) as GAMInterstitialAd;
  }

  addAdEventsListener<T extends AdEventType | GAMAdEventType>(listener: AdEventsListener<T>) {
    return this._addAdEventsListener(listener);
  }

  addAdEventListener<T extends AdEventType | GAMAdEventType>(
    type: T,
    listener: AdEventListener<T>,
  ) {
    return this._addAdEventListener(type, listener);
  }
}
