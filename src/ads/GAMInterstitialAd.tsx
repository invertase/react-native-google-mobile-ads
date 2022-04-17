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
   * interstitialAd.onAdEvent((type, error) => {
   *   console.log('New event: ', type, error);
   *
   *   if (type === AdEventType.LOADED) {
   *     interstitialAd.show();
   *   }
   * });
   *
   * interstitialAd.load();
   * ```
   *
   * @param adUnitId The Ad Unit ID for the Interstitial. You can find this on your Google Mobile Ads dashboard.
   * @param requestOptions Optional RequestOptions used to load the ad.
   */
  static override createForAdRequest(
    adUnitId: string,
    requestOptions?: RequestOptions,
  ): GAMInterstitialAd {
    return super.createForAdRequest(adUnitId, requestOptions);
  }
}
