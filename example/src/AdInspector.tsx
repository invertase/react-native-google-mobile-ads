import {Test, TestType, TestResult} from 'jet';
import React from 'react';
import {View, Button, StyleSheet} from 'react-native';
import MobileAds from 'react-native-google-mobile-ads';

export class AdInspectorTest implements Test {
  getPath(): string {
    return 'AdInspectorTest';
  }

  getTestType(): TestType {
    return TestType.Interactive;
  }

  render(onMount: (component: any) => void): React.ReactNode {
    return (
      <View style={styles.testSpacing} ref={onMount}>
        <Button
          title="Show Ad Inspector"
          onPress={() => {
            MobileAds().openAdInspector();
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

const styles = StyleSheet.create({
  testSpacing: {
    margin: 10,
    padding: 10,
  },
});
