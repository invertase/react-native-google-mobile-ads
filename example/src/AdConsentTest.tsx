import React from 'react';
import {Button, StyleSheet, Text, View} from 'react-native';
import {Test, TestResult, TestType} from 'jet';

import {
  AdsConsent,
  AdsConsentDebugGeography,
} from 'react-native-google-mobile-ads';

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

            if (consentInfo.isConsentFormAvailable) {
              await AdsConsent.showForm();

              const choices = await AdsConsent.getUserChoices();

              console.log(JSON.stringify(choices, null, 2));
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

const styles = StyleSheet.create({
  testSpacing: {
    margin: 10,
    padding: 10,
  },
});

export default AdConsentTest;
