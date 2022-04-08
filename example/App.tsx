import React, {useEffect} from 'react';
import {
  Button,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {Test, TestRegistry, TestResult, TestRunner, TestType} from 'jet';

import {
  AdsConsent,
  AdsConsentDebugGeography,
  AdsConsentStatus,
  AppOpenAd,
  InterstitialAd,
  TestIds,
  BannerAd,
  BannerAdSize,
  RewardedAd,
  useInterstitialAd,
  AdEventType,
  RewardedAdEventType,
} from 'react-native-google-mobile-ads';

const appOpen = AppOpenAd.createForAdRequest(TestIds.APP_OPEN, {
  requestNonPersonalizedAdsOnly: true,
});

class AppOpenTest implements Test {
  adListener = undefined;
  adLoaded = false;

  constructor() {
    appOpen.load();
    // Current no way in jet-next to re-render on async completion or to delay render? But still can log it
    this.adListener = appOpen.onAdEvent((type, error) => {
      console.log(`${Platform.OS} app open ad event: ${type}`);
      if (type === AdEventType.ERROR) {
        console.log(`${Platform.OS} rewarded error: ${error}`);
      }
      if (type === AdEventType.LOADED) {
        this.adLoaded = true;
      }
    });
  }

  getPath(): string {
    return 'AppOpen';
  }

  getTestType(): TestType {
    return TestType.Interactive;
  }

  render(onMount: (component: any) => void): React.ReactNode {
    return (
      <View style={styles.testSpacing} ref={onMount}>
        <Button
          title="Show App Open Ad"
          onPress={() => {
            appOpen.show();
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
      this.adListener();
    }
  }
}

const interstitial = InterstitialAd.createForAdRequest(TestIds.INTERSTITIAL, {
  // requestNonPersonalizedAdsOnly: true,
  // keywords: ['fashion', 'clothing'],
});

// To implement a test you must make a new object implementing a specific interface.
class InterstitialTest implements Test {
  adListener = undefined;
  adLoaded = false;

  constructor() {
    interstitial.load();
    // Current no way in jet-next to re-render on async completion or to delay render? But still can log it
    this.adListener = interstitial.onAdEvent((type, error) => {
      console.log(`${Platform.OS} interstitial ad event: ${type}`);
      if (type === AdEventType.ERROR) {
        console.log(`${Platform.OS} rewarded error: ${error}`);
      }
      if (type === AdEventType.LOADED) {
        this.adLoaded = true;
      }
    });
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
      this.adListener();
    }
  }
}

class BannerTest implements Test {
  getPath(): string {
    return 'Banner';
  }

  getTestType(): TestType {
    return TestType.Interactive;
  }

  render(onMount: (component: any) => void): React.ReactNode {
    return (
      <View ref={onMount}>
        <BannerAd
          unitId={TestIds.BANNER}
          size={BannerAdSize.ADAPTIVE_BANNER}
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

const rewarded = RewardedAd.createForAdRequest(TestIds.REWARDED, {
  requestNonPersonalizedAdsOnly: true,
  keywords: ['fashion', 'clothing'],
});
class RewardedTest implements Test {
  adListener = undefined;
  adLoaded = false;

  constructor() {
    rewarded.load();
    // Current no way in jet-next to re-render on async completion or to delay render? But still can log it
    this.adListener = rewarded.onAdEvent((type, error, data) => {
      console.log(`${Platform.OS} rewarded ad event: ${type}`);
      if (type === AdEventType.ERROR) {
        console.log(`${Platform.OS} rewarded error: ${error}`);
      }
      if (type === RewardedAdEventType.LOADED) {
        console.log(`${Platform.OS} reward: ${JSON.stringify(data)})`);
        this.adLoaded = true;
      }
    });
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
      this.adListener();
    }
  }
}

class AdConsentTest implements Test {
  getPath(): string {
    return 'ConsentForm';
  }

  getTestType(): TestType {
    return TestType.Interactive;
  }

  render(onMount: (component: any) => void): React.ReactNode {
    return (
      <View style={styles.testSpacing} ref={onMount}>
        <Button
          title="Show Consent Form"
          onPress={async () => {
            const consentInfo = await AdsConsent.requestInfoUpdate({
              debugGeography: AdsConsentDebugGeography.EEA,
              testDeviceIdentifiers: [],
            });

            if (
              consentInfo.isConsentFormAvailable &&
              consentInfo.status === AdsConsentStatus.REQUIRED
            ) {
              await AdsConsent.showForm();
            }
          }}
        />

        <Text>
          This test case will not work with the test App ID. You must configure
          your real App ID in app.json and the Consent Form in AdMob/Ad Manager.
          If you are running this test on a device instead of an emulator and if
          you are currently not located in EEA, you have to add your Decive ID
          to the testDeviceIdentifiers of this test case as well.
        </Text>
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

const InterstitialHookComponent = React.forwardRef<View>((_, ref) => {
  const {load, show, isLoaded} = useInterstitialAd(TestIds.INTERSTITIAL);
  useEffect(() => {
    load();
  }, [load]);
  return (
    <View style={styles.testSpacing} ref={ref}>
      <Text>Loaded? {isLoaded ? 'true' : 'false'}</Text>
      <Button
        title="Show Interstitial"
        disabled={!isLoaded}
        onPress={() => {
          show();
        }}
      />
    </View>
  );
});

class InterstitialHookTest implements Test {
  getPath(): string {
    return 'InterstitialHook';
  }

  getTestType(): TestType {
    return TestType.Interactive;
  }

  render(onMount: (component: any) => void): React.ReactNode {
    return <InterstitialHookComponent ref={onMount} />;
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
TestRegistry.registerTest(new AppOpenTest());
TestRegistry.registerTest(new InterstitialTest());
TestRegistry.registerTest(new RewardedTest());
TestRegistry.registerTest(new AdConsentTest());
TestRegistry.registerTest(new InterstitialHookTest());

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
