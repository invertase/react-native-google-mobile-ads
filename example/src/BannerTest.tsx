import React from 'react';
import {Platform, View} from 'react-native';
import {Test, TestResult, TestType} from 'jet';

import {BannerAd, BannerAdSize, TestIds} from 'react-native-google-mobile-ads';

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
          onAdFailedToLoad={(error: Error) => {
            console.log(`${Platform.OS} banner error: ${error.message}`);
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

export default BannerTest;
