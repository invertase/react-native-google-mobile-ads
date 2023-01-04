import { NativeModules } from 'react-native';

const RNGoogleMobileAdsDebugModule = NativeModules.RNGoogleMobileAdsDebugModule;

export const Debug = {
  openDebugMenu(adUnit: string) {
    RNGoogleMobileAdsDebugModule.openDebugMenu(adUnit);
  },
};
