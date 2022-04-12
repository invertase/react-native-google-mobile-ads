import React, {useEffect} from 'react';
import {Button, Platform, StyleSheet, Text, View} from 'react-native';
import {Test, TestType, TestResult} from 'jet';

import {
  AdEventType,
  InterstitialAd,
  TestIds,
  useInterstitialAd,
} from 'react-native-google-mobile-ads';

const interstitial = InterstitialAd.createForAdRequest(TestIds.INTERSTITIAL, {
  // requestNonPersonalizedAdsOnly: true,
  // keywords: ['fashion', 'clothing'],
});

class InterstitialTest implements Test {
  adListener = undefined;
  adLoaded = false;

  constructor() {
    interstitial.load();
    // Current no way in jet-next to re-render on async completion or to delay render? But still can log it
    this.adListener = interstitial.onAdEvent((type, error) => {
      console.log(`${Platform.OS} interstitial ad event: ${type}`);
      if (type === AdEventType.ERROR) {
        console.log(`${Platform.OS} interstitial error: ${error.message}`);
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

const InterstitialHookComponent = React.forwardRef<View>((_, ref) => {
  const {load, show, error, isLoaded, isClicked, isClosed, isOpened} =
    useInterstitialAd(TestIds.INTERSTITIAL);
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    if (error !== undefined) {
      console.log(`${Platform.OS} interstitial hook error: ${error.message}`);
    }
  }, [error]);
  useEffect(() => {
    console.log(
      `${Platform.OS} interstitial hook state - loaded/opened/clicked/closed: ${isLoaded}/${isOpened}/${isClicked}/${isClosed}`,
    );
  }, [isLoaded, isOpened, isClicked, isClosed]);

  return (
    <View style={styles.testSpacing} ref={ref}>
      <Text>Loaded? {isLoaded ? 'true' : 'false'}</Text>
      <Text>Error? {error ? error.message : 'false'}</Text>
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

export class InterstitialHookTest implements Test {
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

const styles = StyleSheet.create({
  testSpacing: {
    margin: 10,
    padding: 10,
  },
});

export default InterstitialTest;
