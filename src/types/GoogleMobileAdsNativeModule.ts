import { AdapterStatus } from './AdapterStatus';
import { RequestConfiguration } from './RequestConfiguration';

export interface GoogleMobileAdsNativeModule {
  initialize(): Promise<AdapterStatus[]>;
  setRequestConfiguration(requestConfiguration?: RequestConfiguration): Promise<void>;
  openAdInspector(): Promise<void>;
  openDebugMenu(adUnit: string): void;
}
