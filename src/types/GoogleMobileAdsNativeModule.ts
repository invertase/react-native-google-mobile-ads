import { AdapterStatus } from './AdapterStatus';
import { RequestConfiguration } from './RequestConfiguration';
import { RequestOptions } from './RequestOptions';
import { AdShowOptions } from './AdShowOptions';

type AdLoadFunction = (requestId: number, adUnitId: string, requestOptions: RequestOptions) => void;
type AdShowFunction = (
  requestId: number,
  adUnitId: string,
  showOptions?: AdShowOptions,
) => Promise<void>;

export interface GoogleMobileAdsNativeModule {
  initialize(): Promise<AdapterStatus[]>;
  setRequestConfiguration(requestConfiguration?: RequestConfiguration): Promise<void>;
  openAdInspector(): Promise<void>;
  appOpenLoad: AdLoadFunction;
  appOpenShow: AdShowFunction;
  interstitialLoad: AdLoadFunction;
  interstitialShow: AdShowFunction;
  rewardedLoad: AdLoadFunction;
  rewardedShow: AdShowFunction;
  rewardedInterstitialLoad: AdLoadFunction;
  rewardedInterstitialShow: AdShowFunction;
}
