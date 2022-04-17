import React from 'react';
import {Button, Platform, StyleSheet, View} from 'react-native';
import {Test, TestResult, TestType} from 'jet';

import {
  AdEventType,
  GAMInterstitialAd,
  TestIds,
} from 'react-native-google-mobile-ads';
import {GAMAdEventType} from '../../lib/typescript/GAMAdEventType';

const interstitial = GAMInterstitialAd.createForAdRequest(
  TestIds.GAM_INTERSTITIAL,
  {
    // requestNonPersonalizedAdsOnly: true,
    // keywords: ['fashion', 'clothing'],
  },
);

class GAMInterstitialTest implements Test {
  adListener = undefined;
  adLoaded = false;

  constructor() {
    interstitial.load();
    // Current no way in jet-next to re-render on async completion or to delay render? But still can log it
    this.adListener = interstitial.onAdEvent((type, error, data) => {
      console.log(`${Platform.OS} GAM interstitial ad event: ${type}`);
      if (type === AdEventType.ERROR) {
        console.log(`${Platform.OS} GAM interstitial error: ${error.message}`);
      }
      if (type === AdEventType.LOADED) {
        this.adLoaded = true;
      }
      if (type === GAMAdEventType.APP_EVENT) {
        console.log(
          `${Platform.OS} GAM interstitial app event: ${JSON.stringify(data)}`,
        );
      }
    });
  }

  getPath(): string {
    return 'GAMInterstitial';
  }

  getTestType(): TestType {
    return TestType.Interactive;
  }

  render(onMount: (component: any) => void): React.ReactNode {
    return (
      <View style={styles.testSpacing} ref={onMount}>
        <Button
          title="Show Interstitial"
          disabled={!this.adLoaded}
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

const styles = StyleSheet.create({
  testSpacing: {
    margin: 10,
    padding: 10,
  },
});

export default GAMInterstitialTest;
