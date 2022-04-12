import React from 'react';
import {SafeAreaView, ScrollView} from 'react-native';
import {TestRegistry, TestRunner} from 'jet';

import MobileAds from 'react-native-google-mobile-ads';

import AppOpenTest from './src/AppOpenTest';
import BannerTest from './src/BannerTest';
import InterstitialTest from './src/InterstitialTest';
import RewardedTest from './src/RewardedTest';
import AdConsentTest from './src/AdConsentTest';
import AppOpenHookTest from './src/AppOpenHookTest';
import InterstitialHookTest from './src/InterstitialHookTest';
import RewardedHookTest from './src/RewardedHookTest';
import GAMBannerTest from './src/GAMBannerTest';
import GAMInterstitialTest from './src/GAMInterstitialTest';

MobileAds().initialize();
MobileAds().setRequestConfiguration({
  testDeviceIdentifiers: ['BFA865282E0FD003C10ACA4D9DD8A51A'],
});

// All tests must be registered - a future feature will allow auto-bundling of tests via configured path or regex
TestRegistry.registerTest(new AppOpenTest());
TestRegistry.registerTest(new BannerTest());
TestRegistry.registerTest(new InterstitialTest());
TestRegistry.registerTest(new RewardedTest());
TestRegistry.registerTest(new AdConsentTest());
TestRegistry.registerTest(new AppOpenHookTest());
TestRegistry.registerTest(new InterstitialHookTest());
TestRegistry.registerTest(new RewardedHookTest());
TestRegistry.registerTest(new GAMBannerTest());
TestRegistry.registerTest(new GAMInterstitialTest());

const App = () => {
  return (
    <SafeAreaView>
      <ScrollView contentInsetAdjustmentBehavior="automatic">
        <TestRunner />
      </ScrollView>
    </SafeAreaView>
  );
};

export default App;
