import { NativeModules } from 'react-native';
import { DebugInterface } from './types/Debug.interface';

const RNGoogleMobileAdsDebugModule = NativeModules.RNGoogleMobileAdsDebugModule;

export const Debug: DebugInterface = {
  openDebugMenu(adUnit: string) {
    RNGoogleMobileAdsDebugModule.openDebugMenu(adUnit);
  },
};
