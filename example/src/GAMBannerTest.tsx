import React from 'react';
import {Platform, View} from 'react-native';
import {Test, TestResult, TestType} from 'jet';

import {
  BannerAdSize,
  GAMBannerAd,
  TestIds,
} from 'react-native-google-mobile-ads';

class GAMBannerTest implements Test {
  getPath(): string {
    return 'GAMBanner';
  }

  getTestType(): TestType {
    return TestType.Interactive;
  }

  render(onMount: (component: any) => void): React.ReactNode {
    return (
      <View ref={onMount}>
        {/* To test FLUID size ad, use `TestIds.GAM_NATIVE` */}
        <GAMBannerAd
          unitId={TestIds.GAM_BANNER}
          sizes={[BannerAdSize.ADAPTIVE_BANNER]}
          requestOptions={{
            requestNonPersonalizedAdsOnly: true,
          }}
          onAdFailedToLoad={(error: Error) => {
            console.log(`${Platform.OS} GAM banner error: ${error.message}`);
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

export default GAMBannerTest;
