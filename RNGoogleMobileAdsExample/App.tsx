import React from 'react';
import {Platform, SafeAreaView, ScrollView} from 'react-native';

import {
  TestIds,
  BannerAdSize,
  GAMBannerAd,
} from 'react-native-google-mobile-ads';

import {NavigationContainer} from '@react-navigation/native';
import {createStackNavigator} from '@react-navigation/stack';

const App = () => {
  const Stack = createStackNavigator();

  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="AdScreen">
          {props => (
            <ScrollView contentInsetAdjustmentBehavior="automatic">
              <GAMBannerAd
                unitId={TestIds.GAM_BANNER}
                sizes={[BannerAdSize.MEDIUM_RECTANGLE]}
                requestOptions={{
                  requestNonPersonalizedAdsOnly: true,
                }}
                onAdFailedToLoad={(error: Error) => {
                  console.log(
                    `${Platform.OS} GAM banner error: ${error.message}`,
                  );
                }}
                onAdImpression={() => {
                  console.log('Ad impression');
                }}
              />
            </ScrollView>
          )}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default App;
