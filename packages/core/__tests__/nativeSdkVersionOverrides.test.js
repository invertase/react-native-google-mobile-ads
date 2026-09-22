'use strict';

const fs = require('fs');
const path = require('path');

const coreRoot = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(coreRoot, ...parts), 'utf8');

const packageJson = require('../package.json');
const androidBuild = read('android', 'build.gradle');
const podspec = read('RNGoogleMobileAds.podspec');
const androidModule = read(
  'android',
  'src',
  'classic',
  'java',
  'io',
  'invertase',
  'googlemobileads',
  'ReactNativeGoogleMobileAdsModule.kt',
);
const iosModule = read('ios', 'RNGoogleMobileAds', 'RNGoogleMobileAdsModule.mm');
const capabilitySource = read('src', 'capabilities', 'getAdCapabilities.ts');
const pluginSource = read('plugin', 'src', 'index.ts');

describe('native SDK version overrides', () => {
  it('keeps the package default pins in the ReactNative version map', () => {
    const { googleMobileAds, googleMobileAdsNextGen, googleUmp } = packageJson.sdkVersions.android;

    expect(androidBuild).toContain(
      `def googleMobileAdsVersion = packageJson['sdkVersions']['android']['googleMobileAds']`,
    );
    expect(androidBuild).toContain(
      `def googleUmpVersion = packageJson['sdkVersions']['android']['googleUmp']`,
    );
    expect(androidBuild).toContain('sdk: googleMobileAdsVersion');
    expect(androidBuild).toContain('consent: googleUmpVersion');
    expect(googleMobileAds).toBe('25.4.0');
    expect(googleMobileAdsNextGen).toBe('1.4.0');
    expect(googleUmp).toBe('4.0.0');
  });

  it('resolves Android dependencies through the app-overridable ReactNative map', () => {
    expect(androidBuild).toContain(
      'play-services-ads:${ReactNative.ext.getVersion("googleMobileAds", "sdk")}',
    );
    expect(androidBuild).toContain(
      'user-messaging-platform:${ReactNative.ext.getVersion("ads", "consent")}',
    );
    expect(androidBuild).toContain(
      'ads-mobile-sdk:${ReactNative.ext.getVersion("googleMobileAds", "nextGenSdk")}',
    );
    expect(androidBuild).toContain('module: "play-services-ads-lite"');
  });

  it('gives iOS ENV precedence over Podfile globals and package defaults', () => {
    const adsEnv = podspec.indexOf("if ENV['RNGMA_IOS_GOOGLE_MOBILE_ADS_SDK_VERSION']");
    const adsGlobal = podspec.indexOf('elsif defined?($RNGoogleMobileAdsSDKVersion)');
    const adsDependency = podspec.indexOf(
      "s.dependency          'Google-Mobile-Ads-SDK', google_mobile_ads_sdk_version",
    );
    const umpEnv = podspec.indexOf("if ENV['RNGMA_IOS_GOOGLE_UMP_SDK_VERSION']");
    const umpGlobal = podspec.indexOf('elsif defined?($RNGoogleUmpSDKVersion)');
    const umpDependency = podspec.indexOf(
      "s.dependency          'GoogleUserMessagingPlatform', google_ump_sdk_version",
    );

    expect(adsEnv).toBeGreaterThan(-1);
    expect(adsEnv).toBeLessThan(adsGlobal);
    expect(adsGlobal).toBeLessThan(adsDependency);
    expect(umpEnv).toBeGreaterThan(-1);
    expect(umpEnv).toBeLessThan(umpGlobal);
    expect(umpGlobal).toBeLessThan(umpDependency);
    expect(packageJson.sdkVersions.ios).toEqual({
      googleMobileAds: '13.6.0',
      googleUmp: '3.1.0',
    });
  });

  it('reports the actually linked SDK through synchronous native constants', () => {
    expect(androidModule).toContain('"sdkVersion" to MobileAds.getVersion().toString()');
    expect(iosModule).toContain(
      'GADVersionNumber version = GADMobileAds.sharedInstance.versionNumber',
    );
    expect(iosModule).toContain('[NSString stringWithFormat:@"%ld.%ld.%ld"');
    expect(iosModule).not.toContain('GADGetStringFromVersionNumber');
    expect(capabilitySource).toContain(
      'const { sdkVersion } = NativeGoogleMobileAdsModule.getConstants();',
    );
    expect(capabilitySource).not.toMatch(/25\.4\.0|13\.6\.0|SDK_VERSION/);
  });

  it('does not add SDK override fields to the Expo plugin', () => {
    expect(pluginSource).not.toMatch(
      /RNGMA_IOS_GOOGLE_(?:MOBILE_ADS|UMP)_SDK_VERSION|googleMobileAdsSdkVersion|googleUmpSdkVersion/,
    );
  });
});
