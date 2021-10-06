import React from 'react';
import {SafeAreaView, ScrollView, Text, View} from 'react-native';
import {
  AutoExecutableTest,
  TestRegistry,
  TestResult,
  TestRunner,
  TestType,
} from 'jet';

// To implement a test you must make a new object implementing a specific interface.
class ExampleTest implements AutoExecutableTest {
  getPath(): string {
    return 'Example';
  }

  getTestType(): TestType {
    return TestType.AutoExecutable;
  }

  render(onMount: (component: any) => void): React.ReactNode {
    return (
      <View ref={onMount}>
        <Text>
          {'This is rendered if a user taps the test in the test list.'}
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

// All tests must be registered - a future feature will allow auto-bundling of tests via configured path or regex
TestRegistry.registerTest(new ExampleTest());

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
