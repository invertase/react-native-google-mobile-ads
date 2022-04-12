import React, {useEffect} from 'react';
import {Button, Platform, StyleSheet, Text, View} from 'react-native';
import {Test, TestResult, TestType} from 'jet';

import {TestIds, useRewardedAd} from 'react-native-google-mobile-ads';

const RewardedHookComponent = React.forwardRef<View>((_, ref) => {
  const {
    load,
    show,
    isLoaded,
    error,
    reward,
    isEarnedReward,
    isOpened,
    isClosed,
    isClicked,
  } = useRewardedAd(TestIds.REWARDED);
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    if (error !== undefined) {
      console.log(`${Platform.OS} rewarded hook error: ${error.message}`);
    }
  }, [error]);
  useEffect(() => {
    if (reward !== undefined) {
      console.log(`${Platform.OS} hook reward: ${JSON.stringify(reward)}`);
    }
  }, [reward]);
  useEffect(() => {
    console.log(
      `${Platform.OS} rewarded hook state - loaded/earned/opened/clicked/closed: ${isLoaded}/${isEarnedReward}/${isOpened}/${isClicked}/${isClosed}`,
    );
  }, [isLoaded, isEarnedReward, isOpened, isClicked, isClosed]);

  return (
    <View style={styles.testSpacing} ref={ref}>
      <Text>Loaded? {isLoaded ? 'true' : 'false'}</Text>
      <Text>Error? {error ? error.message : 'false'}</Text>
      <Button
        title="Show Rewarded"
        disabled={!isLoaded}
        onPress={() => {
          show();
        }}
      />
    </View>
  );
});

class RewardedHookTest implements Test {
  getPath(): string {
    return 'RewardedHook';
  }

  getTestType(): TestType {
    return TestType.Interactive;
  }

  render(onMount: (component: any) => void): React.ReactNode {
    return <RewardedHookComponent ref={onMount} />;
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

export default RewardedHookTest;
