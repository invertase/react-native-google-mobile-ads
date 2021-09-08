import React from 'react';
import {SafeAreaView, ScrollView} from 'react-native';
import {Test, TestRegistry, TestRunner} from 'jet';

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
