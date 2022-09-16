## [8.1.0](https://github.com/invertase/react-native-google-mobile-ads/compare/v8.0.1...v8.1.0) (2022-09-16)


### Features

* **deps:** native admob SDK bumps - iOS 9.10.0 / android 21.2.0 ([b6b5c6f](https://github.com/invertase/react-native-google-mobile-ads/commit/b6b5c6f858664e77f0c00051b1eabb942bf899cd))

### [8.0.1](https://github.com/invertase/react-native-google-mobile-ads/compare/v8.0.0...v8.0.1) (2022-09-07)


### Bug Fixes

* **android:** robustly handle full-screen load exceptions ([fa79d87](https://github.com/invertase/react-native-google-mobile-ads/commit/fa79d878d9653439723cc2753eb0b4c9e790ab78))
* **deps:** android sdk 21.1.0 / ios sdk 9.9.0 ([3778a89](https://github.com/invertase/react-native-google-mobile-ads/commit/3778a8961cde96a6692438168b7ed74d8acbb544))

## [8.0.0](https://github.com/invertase/react-native-google-mobile-ads/compare/v7.0.1...v8.0.0) (2022-09-06)


### ⚠ BREAKING CHANGES

* **hooks:** `isLoaded` becomes false after a fullscreen ad was shown.

### Features

* **hooks:** automatically set isLoaded to false ([#199](https://github.com/invertase/react-native-google-mobile-ads/issues/199)) ([9d0ecac](https://github.com/invertase/react-native-google-mobile-ads/commit/9d0ecaccbb873cad3c3bd21589e7662760c094c6))

### [7.0.1](https://github.com/invertase/react-native-google-mobile-ads/compare/v7.0.0...v7.0.1) (2022-06-26)


### Bug Fixes

* **android, build:** correct kotlin plugin dependency ([d3e41e9](https://github.com/invertase/react-native-google-mobile-ads/commit/d3e41e908e626f52494ca0e92c3d48efed040d2f))

## [7.0.0](https://github.com/invertase/react-native-google-mobile-ads/compare/v6.3.0...v7.0.0) (2022-06-24)


### ⚠ BREAKING CHANGES

* **android, sdk:** your android app must have minSdkVersion of 19 or higher to use this version
* **ios, sdk:** your Xcode version must be 13.2.1 or higher to use this version

### Features

* **android, sdk:** adopt native sdk v21, minSdkVersion now 19 ([1f17e15](https://github.com/invertase/react-native-google-mobile-ads/commit/1f17e15dfafd83cf48fc98ba957eb5bc82294202))
* **android:** init/load optimization toggles, default true, override in app.json ([05cbc7a](https://github.com/invertase/react-native-google-mobile-ads/commit/05cbc7a454ee03b05e0bfdd2adc6e092d45d6d64))
* build-time error if app.json not configured correctly ([9139bd8](https://github.com/invertase/react-native-google-mobile-ads/commit/9139bd86a55a2f82a0577c802f698df208ef30e6)), closes [#84](https://github.com/invertase/react-native-google-mobile-ads/issues/84)
* **ios, sdk:** use google-mobile-ads-sdk 9.6.0 ([5ef755b](https://github.com/invertase/react-native-google-mobile-ads/commit/5ef755bb4f86105399cac85379b4e2b3f397dce5))

## [6.3.0](https://github.com/invertase/react-native-google-mobile-ads/compare/v6.2.5...v6.3.0) (2022-05-31)


### Features

* add ppid option to request options ([#153](https://github.com/invertase/react-native-google-mobile-ads/issues/153)) ([8bbfc05](https://github.com/invertase/react-native-google-mobile-ads/commit/8bbfc058b20f599acc3fd91d0145c4f974bf2d09))

### [6.2.5](https://github.com/invertase/react-native-google-mobile-ads/compare/v6.2.4...v6.2.5) (2022-05-14)


### Bug Fixes

* fix ad inspector callback error ([c652d5e](https://github.com/invertase/react-native-google-mobile-ads/commit/c652d5eca0d0c0e303b8450f13f9945c5c2e7964))
* fix false error in rewarded interstitial with valid event type value ([#148](https://github.com/invertase/react-native-google-mobile-ads/issues/148)) ([7ee21bf](https://github.com/invertase/react-native-google-mobile-ads/commit/7ee21bf928c690ff54e7946c469ea6a3bbe7e6b1))

### [6.2.4](https://github.com/invertase/react-native-google-mobile-ads/compare/v6.2.3...v6.2.4) (2022-05-12)


### Bug Fixes

* **android:** send ad size before ad loads ([3049ea3](https://github.com/invertase/react-native-google-mobile-ads/commit/3049ea34f4f7aaedd7bd20fae7be7e1de54159cc))

### [6.2.3](https://github.com/invertase/react-native-google-mobile-ads/compare/v6.2.2...v6.2.3) (2022-05-12)


### Bug Fixes

* **ios:** use python3, fixes issues on macOS 12.3+ ([df4acef](https://github.com/invertase/react-native-google-mobile-ads/commit/df4acefc0e5d448f0d6e4bdad369f2d783fd5042))

### [6.2.2](https://github.com/invertase/react-native-google-mobile-ads/compare/v6.2.1...v6.2.2) (2022-05-10)


### Bug Fixes

* allow undefined configuration properties ([#138](https://github.com/invertase/react-native-google-mobile-ads/issues/138)) ([6a083fd](https://github.com/invertase/react-native-google-mobile-ads/commit/6a083fdb4687726784c1d497d3cce502c1d4f60a))
* batch banner ad prop update ([c6aea8b](https://github.com/invertase/react-native-google-mobile-ads/commit/c6aea8bf71bfd3a1275a1ffbc9d6011e8d5c9ae6))

### [6.2.1](https://github.com/invertase/react-native-google-mobile-ads/compare/v6.2.0...v6.2.1) (2022-05-06)


### Bug Fixes

* **ios:** already presenting another view controller ([138df47](https://github.com/invertase/react-native-google-mobile-ads/commit/138df47b06b89cb650425dfca6ded5a7c24dc128))

## [6.2.0](https://github.com/invertase/react-native-google-mobile-ads/compare/v6.1.0...v6.2.0) (2022-05-04)


### Features

* add inline adaptive banners support ([b0f084e](https://github.com/invertase/react-native-google-mobile-ads/commit/b0f084e8a25b3faa7e671022140d4b75bb61a6ac))

## [6.1.0](https://github.com/invertase/react-native-google-mobile-ads/compare/v6.0.1...v6.1.0) (2022-04-29)


### Features

* add rewarded interstitial ad ([10c6770](https://github.com/invertase/react-native-google-mobile-ads/commit/10c6770845f4b5cb3812d4f22587062cce8398dd))

### [6.0.1](https://github.com/invertase/react-native-google-mobile-ads/compare/v6.0.0...v6.0.1) (2022-04-28)


### Bug Fixes

* **types:** openAdInspector returns Promise, not function ([#123](https://github.com/invertase/react-native-google-mobile-ads/issues/123)) ([ccbf881](https://github.com/invertase/react-native-google-mobile-ads/commit/ccbf881f25aa0ddfc3a95114b407f2f19cf06e37))

## [6.0.0](https://github.com/invertase/react-native-google-mobile-ads/compare/v5.1.1...v6.0.0) (2022-04-27)


### ⚠ BREAKING CHANGES

* Event Listeners work differently now ([#110](https://github.com/invertase/react-native-google-mobile-ads/issues/110))

There is a migration doc! 
The migration doc has code samples with the changes necessary, we hope it is easy - it is supposed to be easy
https://github.com/invertase/react-native-google-mobile-ads/blob/main/docs/migrating-to-v6.mdx

### Features

* add Ad Inspector ([#116](https://github.com/invertase/react-native-google-mobile-ads/issues/116)) ([dd36436](https://github.com/invertase/react-native-google-mobile-ads/commit/dd364367aa60006c1a8f7a1ea153ff408ec1b03b))
* add addAdEventListener method ([#110](https://github.com/invertase/react-native-google-mobile-ads/issues/110)) ([e842477](https://github.com/invertase/react-native-google-mobile-ads/commit/e8424778159cc15d907519729d75343a4f6df5b4))
* Add Google Ad Manager support ([#105](https://github.com/invertase/react-native-google-mobile-ads/issues/105)) ([48f77da](https://github.com/invertase/react-native-google-mobile-ads/commit/48f77da3f26e12bf75247f94195755e0b52f9d2a))
* **android, sdk:** update to google mobile ads sdk 20.6.0 ([26ef269](https://github.com/invertase/react-native-google-mobile-ads/commit/26ef2694197fa8d7c56da12d742ff899a670ac41)), closes [#114](https://github.com/invertase/react-native-google-mobile-ads/issues/114)
* **ios, sdk:** migrate to mobile ads sdk v9 ([36a440a](https://github.com/invertase/react-native-google-mobile-ads/commit/36a440afd29bf92fd550767e77c51090fd72a63d)), closes [#113](https://github.com/invertase/react-native-google-mobile-ads/issues/113)


### Bug Fixes

* fix wrong hook return type omit ([8bbc0ad](https://github.com/invertase/react-native-google-mobile-ads/commit/8bbc0ad742bb0a23b6fecdd718e701985d21086b))

### [5.1.1](https://github.com/invertase/react-native-google-mobile-ads/compare/v5.1.0...v5.1.1) (2022-04-19)


### Bug Fixes

* **ios:** avoid crash on ios < 14 without AppTrackingTransparency ([d03f45a](https://github.com/invertase/react-native-google-mobile-ads/commit/d03f45a7d57571fbd18208a55444c0b1c08bc6fb))

## [5.1.0](https://github.com/invertase/react-native-google-mobile-ads/compare/v5.0.1...v5.1.0) (2022-04-16)


### Features

* **consent:** add method that returns consent choices ([be967bd](https://github.com/invertase/react-native-google-mobile-ads/commit/be967bda774662379c012a7f06f0b2c40cfb2291))
* hooks for all full screen ad types ([#100](https://github.com/invertase/react-native-google-mobile-ads/issues/100)) ([0bd7ce8](https://github.com/invertase/react-native-google-mobile-ads/commit/0bd7ce89f4c7b6d22a04f658de991f89af83069f))

### [5.0.1](https://github.com/invertase/react-native-google-mobile-ads/compare/v5.0.0...v5.0.1) (2022-04-01)


### Bug Fixes

* **android:** use ApplicationContext so mediation adapter init works ([d340943](https://github.com/invertase/react-native-google-mobile-ads/commit/d340943dc8cc2d3875f46db193f706fe3705c1fd))

## [5.0.0](https://github.com/invertase/react-native-google-mobile-ads/compare/v4.2.0...v5.0.0) (2022-03-03)


### ⚠ BREAKING CHANGES

* **consent:** migrate to UMP SDK (#82)

### Features

* **consent:** migrate to UMP SDK ([#82](https://github.com/invertase/react-native-google-mobile-ads/issues/82)) ([fa88240](https://github.com/invertase/react-native-google-mobile-ads/commit/fa88240d937499b4a570c40914f06054dfa31b89))


### Bug Fixes

* android version and app keys ([bab67ff](https://github.com/invertase/react-native-google-mobile-ads/commit/bab67ff9d4a2f7a02e4fd20b7cf311977ca9eec1))

## [4.2.0](https://github.com/invertase/react-native-google-mobile-ads/compare/v4.1.3...v4.2.0) (2022-02-14)


### Features

* custom targeting ([02b3ce4](https://github.com/invertase/react-native-google-mobile-ads/commit/02b3ce48138475cf38b44dc997bb69f6767433f3))

### [4.1.3](https://github.com/invertase/react-native-google-mobile-ads/compare/v4.1.2...v4.1.3) (2022-02-10)


### Bug Fixes

* adRequestOptions ignored ([e15809a](https://github.com/invertase/react-native-google-mobile-ads/commit/e15809a59f538bb8f4585fb58779f59239ec1865))

### [4.1.2](https://github.com/invertase/react-native-google-mobile-ads/compare/v4.1.1...v4.1.2) (2022-02-07)


### Bug Fixes

* **CHANGELOG:** remove duplicate changelog chunk ([d5e59e3](https://github.com/invertase/react-native-google-mobile-ads/commit/d5e59e33491d30cfdf624e76a7555d5c75f60d01))

## [4.0.0](https://github.com/invertase/react-native-google-mobile-ads/compare/v3.4.0...v4.0.0) (2022-02-07)


### ⚠ BREAKING CHANGES

* typescript rewrite (#41)

### Features

* app open ads ([6be7d02](https://github.com/invertase/react-native-google-mobile-ads/commit/6be7d02eb221f5f8c3e6c7baac381fcd6f5a8d20))
* typescript rewrite ([#41](https://github.com/invertase/react-native-google-mobile-ads/issues/41)) ([4114e4b](https://github.com/invertase/react-native-google-mobile-ads/commit/4114e4b0d17d70feca2e8220962eb7545261727d))


### Bug Fixes

* **android:** no banner ads loaded in the first render ([3154579](https://github.com/invertase/react-native-google-mobile-ads/commit/3154579cd51a7ca98e747a1d73caf0ecd9ad4e2f))
* Block descendant focus requests ([835bdec](https://github.com/invertase/react-native-google-mobile-ads/commit/835bdec6aff843e2ef21250137927fb004750aeb)), closes [/github.com/facebook/react-native/issues/32649#issuecomment-990968256](https://github.com/invertase//github.com/facebook/react-native/issues/32649/issues/issuecomment-990968256)
* **CHANGELOG:** remove duplicate changelog chunk ([d5e59e3](https://github.com/invertase/react-native-google-mobile-ads/commit/d5e59e33491d30cfdf624e76a7555d5c75f60d01))
* point to the right native module ([df30e7b](https://github.com/invertase/react-native-google-mobile-ads/commit/df30e7be02d050b3d69ca152355ec79d6f2131fa))
* **release:** allow semantic-release on beta branch ([106ce63](https://github.com/invertase/react-native-google-mobile-ads/commit/106ce63ce8a64f37a3d7983bfe7f040186b0a62b))
* typo in native event type ([fcb911a](https://github.com/invertase/react-native-google-mobile-ads/commit/fcb911aad7d3739465054dee538954815595b888))

### [4.1.1](https://github.com/invertase/react-native-google-mobile-ads/compare/v4.1.0...v4.1.1) (2022-01-27)


### Bug Fixes

* point to the right native module ([e1d7715](https://github.com/invertase/react-native-google-mobile-ads/commit/e1d77153fadcd3e1c69f497e1768844408618d18))

## [4.1.0](https://github.com/invertase/react-native-google-mobile-ads/compare/v4.0.2...v4.1.0) (2022-01-26)

### ⚠ BREAKING CHANGES

* Rename from `@invertase/react-native-google-ads` to `react-native-google-mobile-ads` to more accurately reflect underlying SDK names (#62)
  - Please change `package.json` to use the new package name
  - Please update all imports to new package name
  - Please change `app.json` key with app ids from `react-native-google-ads` to `react-native-google-mobile-ads` (and run `pod install`)

### Features

* app open ads ([f145716](https://github.com/invertase/react-native-google-mobile-ads/commit/f145716baa9ce05d4172eff5e9df6349937353e6))

### [4.0.2](https://github.com/invertase/react-native-google-ads/compare/v4.0.1...v4.0.2) (2022-01-24)


### Bug Fixes

* Block descendant focus requests ([e39a5fd](https://github.com/invertase/react-native-google-ads/commit/e39a5fd9532dd23186848b7367d6ef11c53757b8)), closes [/github.com/facebook/react-native/issues/32649#issuecomment-990968256](https://github.com/invertase//github.com/facebook/react-native/issues/32649/issues/issuecomment-990968256)
* typo in native event type ([3cfc1ff](https://github.com/invertase/react-native-google-ads/commit/3cfc1ffc00e3850b88fb3589db801a613a3f0b81))

### [4.0.1](https://github.com/invertase/react-native-google-ads/compare/v4.0.0...v4.0.1) (2022-01-24)


### Bug Fixes

* **android:** no banner ads loaded in the first render ([3dc74cf](https://github.com/invertase/react-native-google-ads/commit/3dc74cfba4a6bbdacc0ca9c84a2819ab34378419))

## [4.0.0](https://github.com/invertase/react-native-google-ads/compare/v3.4.0...v4.0.0) (2022-01-06)


### ⚠ BREAKING CHANGES

* typescript rewrite (#41)

### Features

* typescript rewrite ([#41](https://github.com/invertase/react-native-google-ads/issues/41)) ([3a8f742](https://github.com/invertase/react-native-google-ads/commit/3a8f7426e0615063141324a319d0b76c7e8ef937))


### Bug Fixes

* **release:** allow semantic-release on beta branch ([b2d1381](https://github.com/invertase/react-native-google-ads/commit/b2d138198445780334d499d3005dc94c6cc57f82))

## [3.4.0](https://github.com/invertase/react-native-google-ads/compare/v3.3.0...v3.4.0) (2021-12-29)


### Features

* smarter error logging ([#50](https://github.com/invertase/react-native-google-ads/issues/50)) ([c9c4d3b](https://github.com/invertase/react-native-google-ads/commit/c9c4d3b618ac33653df468753d174c11eb0656bc))

## [3.3.0](https://github.com/invertase/react-native-google-ads/compare/v3.2.1...v3.3.0) (2021-12-29)


### Features

* extended error logging ([#49](https://github.com/invertase/react-native-google-ads/issues/49)) ([a92d99d](https://github.com/invertase/react-native-google-ads/commit/a92d99d6c05d6f735fec97d1cf4657815359d7d3))

### [3.2.1](https://github.com/invertase/react-native-google-ads/compare/v3.2.0...v3.2.1) (2021-12-28)


### Bug Fixes

* adUnitId in sendAdevent is nil on error ([d633340](https://github.com/invertase/react-native-google-ads/commit/d633340d25671dbd15f1ef8020ca93b3f833e6c6))

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
