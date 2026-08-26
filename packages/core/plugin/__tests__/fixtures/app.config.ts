export default {
  name: 'example',
  slug: 'example',
  android: {
    package: 'com.example',
  },
  ios: {
    bundleIdentifier: 'com.example',
  },
  plugins: [
    [
      '../../build',
      {
        androidAppId: 'TestAppId',
        iosAppId: 'TestIosId',
        delayAppMeasurementInit: true,
        optimizeInitialization: true,
        optimizeAdLoading: true,
        skAdNetworkItems: ['TestSkAdNetworkItem1', 'TestSkAdNetworkItem2'],
        userTrackingUsageDescription: 'TestUserTrackingUsageDescription',
      },
    ],
  ],
};
