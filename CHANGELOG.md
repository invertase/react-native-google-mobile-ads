## [3.2.0](https://github.com/invertase/react-native-google-ads/compare/v3.1.0...v3.2.0) (2021-12-13)


### Features

* expose native SDK initialize methods as new `initialize` API ([#40](https://github.com/invertase/react-native-google-ads/issues/40)) ([3689b1f](https://github.com/invertase/react-native-google-ads/commit/3689b1f91f7e979792dce9021619154e5961fa02))

## [3.1.0](https://github.com/invertase/react-native-google-ads/compare/v3.0.0...v3.1.0) (2021-12-13)


### Features

* **ios, banner:** replace v7 methods with v8 methods ([#37](https://github.com/invertase/react-native-google-ads/issues/37)) ([c53c657](https://github.com/invertase/react-native-google-ads/commit/c53c6571ec7284c380df026f42dacdb3fa6ffafb))

## [3.0.0](https://github.com/invertase/react-native-google-ads/compare/v2.0.1...v3.0.0) (2021-12-12)


### ⚠ BREAKING CHANGES

Please refer to upstream guides for suggestions on new usage. https://developers.google.com/admob/ios/migration and https://developers.google.com/admob/android/migration
- compileSdkVersion now 31, change your app android build.gradle to 31 if you have not already. Note that JDK11 is required for stable compilation on compileSdkVersion 31, JDK8 has internal compiler errors with SDK31
- onAdLeftApplication removed from the underlying SDK, use react-native built in AppState to determine app went to background
- Smart banner ads removed; use adaptive banner ads. Set height/width explicitly taking into account device size
* android SDK updated to underlying SDK 20

### Features

* android SDK updated to underlying SDK 20 ([56c6058](https://github.com/invertase/react-native-google-ads/commit/56c6058d82908bbf195e8dae720a27310809dc6d))
* **android, sdks:** update to the latest v20 android admob sdk ([#32](https://github.com/invertase/react-native-google-ads/issues/32)) ([291e504](https://github.com/invertase/react-native-google-ads/commit/291e50479ad12ade313ebfa86d47cb9af4d8cc57))

## [2.0.1](https://github.com/invertase/react-native-google-ads/compare/v2.0.0...v2.0.1) (2021-12-12)


### Bug Fixes

* rewarded ads crash & request configuration ([#31](https://github.com/invertase/react-native-google-ads/issues/31)) ([382f146](https://github.com/invertase/react-native-google-ads/commit/382f1468efb5bbe7f45c1aeefa7228400e79eb4f))

# [2.0.0](https://github.com/invertase/react-native-google-ads/compare/v1.0.2...v2.0.0) (2021-12-11)


* feat(ios)!: Google Mobile Ads SDK 8 w/new testDeviceIdentifiers vs testDevices (#30) ([bac264d](https://github.com/invertase/react-native-google-ads/commit/bac264d99f1324961ffcd5ee676baf9d6f49c271)), closes [#30](https://github.com/invertase/react-native-google-ads/issues/30)


### BREAKING CHANGES

* "testDevices" property no longer exists. You must use "testDeviceIdentifiers". The testDeviceIdentifiers property applies to all ad requests, while the old testDevices property was set per-request.

## [1.0.2](https://github.com/invertase/react-native-google-ads/compare/v1.0.1...v1.0.2) (2021-12-09)


### Bug Fixes

* incorrect rn config path ([41a8eca](https://github.com/invertase/react-native-google-ads/commit/41a8ecaa38f115a4259a484d9aecdcade0ff0a9f))

## [1.0.1](https://github.com/invertase/react-native-google-ads/compare/v1.0.0...v1.0.1) (2021-12-08)


### Bug Fixes

* package is org-scoped, but public, allow npm publish ([cd8fbb1](https://github.com/invertase/react-native-google-ads/commit/cd8fbb1f054a4df21e7b8c5fa8e0b4210dd1241d))

# 1.0.0 (2021-12-08)

# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

@react-native-firebase/admob has finally moved to [react-native-google-ads](https://github.com/invertase/react-native-google-ads) 🎉!
As AdMob isn't part anymore of [RNFB](https://github.com/invertase/react-native-firebase), a lot of changes where necessary to extract it completely.
Therefore keep in mind to test everything thoroughly as it's the first release.

* **config:** Add your AdMob app id's (iOS/Android) to app.json and this package will take care of injecting the required entries in your Info.plist (during `pod install` run) & AndroidManifest.xml (during gradle build time).
* **docs:** Improved documentation using the new [docs.page](https://docs.page/)


### Bug Fixes

* android app id from app.json works, example has detox integrated and working in android ([24f83b2](https://github.com/invertase/react-native-google-ads/commit/24f83b2ff6b9fbdcdd5b785ccf0362575af6120a))
* **android:** use correct module name for banner ads ([#17](https://github.com/invertase/react-native-google-ads/issues/17)) ([7c7c8b5](https://github.com/invertase/react-native-google-ads/commit/7c7c8b54643b2094411c5a4cbdd2b1d9d5f780c5))
* displaying banner ads, config in docs ([#14](https://github.com/invertase/react-native-google-ads/issues/14)) ([21e4f42](https://github.com/invertase/react-native-google-ads/commit/21e4f422141cb8c6c8bc9d6cba7dddc51274b8ff))
* incorrect module naming ([#10](https://github.com/invertase/react-native-google-ads/issues/10)) ([79f86b9](https://github.com/invertase/react-native-google-ads/commit/79f86b9d78a95e0fa3024a69bd0b045677176202))
* interstitials and rewarded ads ([#18](https://github.com/invertase/react-native-google-ads/issues/18)) ([9569b98](https://github.com/invertase/react-native-google-ads/commit/9569b98768cacd3f0d3e95b7b44d15d20e59681a))
* **ios:** add ios config scripts missed in previous commit ([227ca7c](https://github.com/invertase/react-native-google-ads/commit/227ca7c95e86916a212c5cf67df83bc8ca77bbcc))
* **ios:** ios app.json --> Info.plist auto-config works now ([6c1f4d4](https://github.com/invertase/react-native-google-ads/commit/6c1f4d42adf389e801814e1508712000130b9626))
* **ios:** missing dollar signs in podspec version override ([#8](https://github.com/invertase/react-native-google-ads/issues/8)) ([5984288](https://github.com/invertase/react-native-google-ads/commit/5984288231027f73ea7f4f03ea9256630aacb382))
* **release:** remove npm config and git config as well ([8139e88](https://github.com/invertase/react-native-google-ads/commit/8139e883a265bf208b71892c7d59742236a69438))
* **release:** semantic release does not need the ssh key agent config ([930bc03](https://github.com/invertase/react-native-google-ads/commit/930bc03dbf4475d0eace5d341041218f58365b18))
* remove incorrect git branch ref in publish workflow, clean changelog ([aec5b84](https://github.com/invertase/react-native-google-ads/commit/aec5b84418153c56d13f9c838f041323bce45189))
* **test:** link to jet package via named branch vs commit hash ([#7](https://github.com/invertase/react-native-google-ads/issues/7)) ([151f6aa](https://github.com/invertase/react-native-google-ads/commit/151f6aae4c37577807ce1e0fbfa8a1b319e20554))


### Features

* example test in new test harness works ([2041fa2](https://github.com/invertase/react-native-google-ads/commit/2041fa24119f29c6714c486439e2ab03eb995818))
* **native:** native code extraction is complete and passes static type check ([02c2af6](https://github.com/invertase/react-native-google-ads/commit/02c2af65ddd947770cf77456c705e0b62e6c7124))
