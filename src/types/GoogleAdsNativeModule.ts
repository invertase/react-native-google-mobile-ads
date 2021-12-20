import { AdapterStatus } from './AdapterStatus';
import { RequestConfiguration } from './RequestConfiguration';
import { RequestOptions } from './RequestOptions';
import { AdShowOptions } from './AdShowOptions';

export interface GoogleAdsNativeModule {
  initialize(): Promise<AdapterStatus[]>;
  setRequestConfiguration(requestConfiguration?: RequestConfiguration): Promise<void>;
  interstitialLoad(requestId: number, adUnitId: string, requestOptions: RequestOptions): void;
  interstitialShow(requestId: number, showOptions?: AdShowOptions): Promise<void>;
  rewardedLoad(requestId: number, adUnitId: string, requestOptions: RequestOptions): void;
  rewardedShow(requestId: number, adUnitId: string, showOptions?: AdShowOptions): Promise<void>;
}
