import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';
import { UnsafeObject } from 'react-native/Libraries/Types/CodegenTypes';

import { AdapterStatus } from './types';

export interface Spec extends TurboModule {
  initialize(): Promise<AdapterStatus[]>;
  setRequestConfiguration(requestConfiguration?: UnsafeObject): Promise<void>;
  openAdInspector(): Promise<void>;
  openDebugMenu(adUnit: string): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('RNGoogleMobileAdsModule');
