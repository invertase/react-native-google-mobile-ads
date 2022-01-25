import React from 'react';
import {Button, SafeAreaView, ScrollView, StyleSheet, View} from 'react-native';
import {Test, TestRegistry, TestResult, TestRunner, TestType} from 'jet';

import {
  InterstitialAd,
  TestIds,
  BannerAd,
  BannerAdSize,
  RewardedAd,
} from 'react-native-google-mobile-ads';

const interstitialAdUnitId = TestIds.INTERSTITIAL;

const interstitial = InterstitialAd.createForAdRequest(interstitialAdUnitId, {
  // requestNonPersonalizedAdsOnly: true,
  // keywords: ['fashion', 'clothing'],
});

// To implement a test you must make a new object implementing a specific interface.
class InterstitialTest implements Test {
  constructor() {
    interstitial.load();
  }

  getPath(): string {
    return 'Interstitial';
  }

  getTestType(): TestType {
    return TestType.Interactive;
  }

  render(onMount: (component: any) => void): React.ReactNode {
    return (
      <View style={styles.testSpacing} ref={onMount}>
        <Button
          title="Show Interstitial"
          onPress={() => {
            interstitial.show();
          }}
        />
      </View>
    );
  }

  execute(component: any, complete: (result: TestResult) => void): void {
    let results = new TestResult();
    try {
      // You can do anything here, it will execute on-device + in-app. Results are aggregated + visible in-app.
    } catch (error) {
      results.errors.push('Received unexpected error...');
    } finally {
      complete(results);
    }
  }
}

const bannerAdUnitId = TestIds.BANNER;

class BannerTest implements Test {
  getPath(): string {
    return 'Banner';
  }

  getTestType(): TestType {
    return TestType.Interactive;
  }

  render(onMount: (component: any) => void): React.ReactNode {
    return (
      <View style={styles.testSpacing} ref={onMount}>
        <BannerAd
          unitId={bannerAdUnitId}
          size={BannerAdSize.FULL_BANNER}
          requestOptions={{
            requestNonPersonalizedAdsOnly: true,
          }}
        />
      </View>
    );
  }

  execute(component: any, complete: (result: TestResult) => void): void {
    let results = new TestResult();
    try {
      // You can do anything here, it will execute on-device + in-app. Results are aggregated + visible in-app.
    } catch (error) {
      results.errors.push('Received unexpected error...');
    } finally {
      complete(results);
    }
  }
}

const rewardedAdUnitId = TestIds.REWARDED;

const rewarded = RewardedAd.createForAdRequest(rewardedAdUnitId, {
  requestNonPersonalizedAdsOnly: true,
  keywords: ['fashion', 'clothing'],
});
class RewaredTest implements Test {
  constructor() {
    rewarded.load();
  }

  getPath(): string {
    return 'Rewarded';
  }

  getTestType(): TestType {
    return TestType.Interactive;
  }

  render(onMount: (component: any) => void): React.ReactNode {
    return (
      <View style={styles.testSpacing} ref={onMount}>
        <Button
          title="Show Rewarded"
          onPress={() => {
            rewarded.show();
          }}
        />
      </View>
    );
  }

  execute(component: any, complete: (result: TestResult) => void): void {
    let results = new TestResult();
    try {
      // You can do anything here, it will execute on-device + in-app. Results are aggregated + visible in-app.
    } catch (error) {
      results.errors.push('Received unexpected error...');
    } finally {
      complete(results);
    }
  }
}

// All tests must be registered - a future feature will allow auto-bundling of tests via configured path or regex
TestRegistry.registerTest(new BannerTest());
TestRegistry.registerTest(new InterstitialTest());
TestRegistry.registerTest(new RewaredTest());

const App = () => {
  return (
    <SafeAreaView>
      <ScrollView contentInsetAdjustmentBehavior="automatic">
        <TestRunner />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  testSpacing: {
    margin: 10,
    padding: 10,
  },
});

export default App;
