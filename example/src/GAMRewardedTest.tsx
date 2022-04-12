import React from 'react';
import {Button, Platform, StyleSheet, View} from 'react-native';
import {Test, TestResult, TestType} from 'jet';

import {
  AdEventType,
  RewardedAd,
  RewardedAdEventType,
  TestIds,
} from 'react-native-google-mobile-ads';

const rewarded = RewardedAd.createForAdRequest(TestIds.GAM_REWARDED, {
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
        console.log(`${Platform.OS} rewarded error: ${error.message}`);
      }
      if (type === RewardedAdEventType.LOADED) {
        console.log(`${Platform.OS} reward: ${JSON.stringify(data)})`);
        this.adLoaded = true;
      }
    });
  }

  getPath(): string {
    return 'GAMRewarded';
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

const styles = StyleSheet.create({
  testSpacing: {
    margin: 10,
    padding: 10,
  },
});

export default RewardedTest;
