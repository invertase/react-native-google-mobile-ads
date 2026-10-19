## [17.3.1](https://github.com/invertase/react-native-google-mobile-ads/compare/v17.3.0...v17.3.1) (2026-10-19)

### Bug Fixes

* **android:** defer nextgen MobileAds init until JS initialize() ([61c2bc9](https://github.com/invertase/react-native-google-mobile-ads/commit/61c2bc902528f2268f1e2730952d5fe6ee6395fc))

## [17.3.0](https://github.com/invertase/react-native-google-mobile-ads/compare/v17.2.0...v17.3.0) (2026-10-16)

### Features

* **ad-manager:** add custom native ads ([4688b18](https://github.com/invertase/react-native-google-mobile-ads/commit/4688b18714e50d3a8076ca28674e66e82a6d5b4c))
* add mobileAds().registerWebView(viewTag) for WebView API for Ads ([a797dde](https://github.com/invertase/react-native-google-mobile-ads/commit/a797dde4e2330044f070b5ff595607b1c795b2b7))
* **facebook:** Meta ATT/DPO hooks and warn on unknown Expo plugin keys ([675e62f](https://github.com/invertase/react-native-google-mobile-ads/commit/675e62f954898ddb489166525a5e8f56cd2833de))
* **ios:** expose setAudioSessionIsApplicationManaged for page video coexistence ([f94470d](https://github.com/invertase/react-native-google-mobile-ads/commit/f94470d02893faae398551cfdd10df48cc571b3e))

### Bug Fixes

* **android:** build NativeAdView with Activity context for click intents ([2c5a3fe](https://github.com/invertase/react-native-google-mobile-ads/commit/2c5a3fe6a30bd964fd6ceff303e7681c7a1a679e))
* **android:** clear Java deprecations and alias ANCHORED to LargeAnchored ([f395a6e](https://github.com/invertase/react-native-google-mobile-ads/commit/f395a6e00d9a072ad46b9c47ee80945207567726))
* **android:** clear Kotlin deprecations with AgeRestrictedTreatment and Event surfaceId ([bc15327](https://github.com/invertase/react-native-google-mobile-ads/commit/bc153276308bdabc0d8e95727317d194bba0607c))
* **android:** clear owned Gradle deprecations and drop manifest package ([d3a45c5](https://github.com/invertase/react-native-google-mobile-ads/commit/d3a45c5c712abe09d241190af9cb120793d9184d))
* **android:** destroy BannerAd on host Activity destroy ([82de758](https://github.com/invertase/react-native-google-mobile-ads/commit/82de7587dfcac65695b266a36587d69a694cca09))
* **android:** guard googleMobileAdsJson when Expo plugin owns app config ([08a8330](https://github.com/invertase/react-native-google-mobile-ads/commit/08a83304883e983702a9e39364b875667f2f6c7c))
* **android:** guard NativeAdView reloadAd against dual-host rebind crash ([e537624](https://github.com/invertase/react-native-google-mobile-ads/commit/e5376242043678e3c8240f4d5c84eeeac3d632e3))
* **android:** keep native-ad SDK overlay above React content for clicks ([5cacb8d](https://github.com/invertase/react-native-google-mobile-ads/commit/5cacb8dcfa5c8c3de1f83c05bcecb6c48766739b))
* **android:** lay out collapsible banners with dynamic measured height ([4b93acf](https://github.com/invertase/react-native-google-mobile-ads/commit/4b93acfc7ae8928071eb0806f9bdb945b2f81c05))
* **android:** refresh BannerAd presentation for hybrid video creatives ([e8b208c](https://github.com/invertase/react-native-google-mobile-ads/commit/e8b208ca8b34db3c67dcc489462f2d53b9975c32))
* **android:** refresh NativeMediaView when pager layout becomes visible ([7a17e1c](https://github.com/invertase/react-native-google-mobile-ads/commit/7a17e1c9f634c4cfd44ad17c149d847710716f34))
* **android:** retain NativeAd AdLoader until createForAdRequest settles ([efc2284](https://github.com/invertase/react-native-google-mobile-ads/commit/efc22840cb72f81192f00cdae4fecdb71f8cc491))
* **android:** stop BannerAd from stealing hardware BACK focus ([3747341](https://github.com/invertase/react-native-google-mobile-ads/commit/37473412bad85a80a127e98502cca477c076e8ea))
* **android:** stop FLUID banner reload loop from sizeConfig and layout ([d1bd432](https://github.com/invertase/react-native-google-mobile-ads/commit/d1bd43292a8b439161a680e4b0c17cd18af8033e))
* **appium:** harden Android multi-format hook and native-overlay navigation ([698a712](https://github.com/invertase/react-native-google-mobile-ads/commit/698a712371a5d89889be3a04698734c532b496a1))
* **example:** skip Kotlin 2.3 metadata check for :app compile ([a71af5e](https://github.com/invertase/react-native-google-mobile-ads/commit/a71af5e01cf6138c81396a2318b7a79307995fb1))
* **ios:** bind fullscreen recovery to show-time presentation ([6c93c11](https://github.com/invertase/react-native-google-mobile-ads/commit/6c93c11f129b7a326d8352dd514a95242f8d974c))
* **ios:** bind presented-ad identity once at present time ([6b33173](https://github.com/invertase/react-native-google-mobile-ads/commit/6b33173da5a6c1f28c30c965bb89d9d3c1f72882))
* **ios:** break Fabric banner paidEventHandler retain cycle ([8a50f58](https://github.com/invertase/react-native-google-mobile-ads/commit/8a50f58dacac477b504ac9f8d504706ab6d242fb))
* **ios:** ceil NativeAdView frame to keep assets inside the ad view ([d20235a](https://github.com/invertase/react-native-google-mobile-ads/commit/d20235a4ec069d9b282d866ba8932c2b233b6cad))
* **ios:** emit fullscreen reward before CLOSED and keep weak delegate alive ([fca10d9](https://github.com/invertase/react-native-google-mobile-ads/commit/fca10d96feb7172e0c0bfd2ccc9e52fcc06eaf8b))
* **ios:** export CeilNativeAdViewFrame with C linkage for .mm callers ([2e3c154](https://github.com/invertase/react-native-google-mobile-ads/commit/2e3c1543ce9373cd90503e883062bf4491e2e816))
* **ios:** expose nativeAd.images in native ad payload ([8ccfe5e](https://github.com/invertase/react-native-google-mobile-ads/commit/8ccfe5e1e2a60913448ff662b506f37a0483cebe))
* **ios:** make fullscreen dismiss recovery scene-safe ([022d616](https://github.com/invertase/react-native-google-mobile-ads/commit/022d6167cc98da1055b37eb98991c266d9636d13))
* **ios:** mark RNGoogleMobileAds config script always out of date ([f1f154e](https://github.com/invertase/react-native-google-mobile-ads/commit/f1f154ee3962009adccef9b657c3811bf5fc398a))
* **ios:** recover touches when fullscreen dismiss callback is skipped ([b848e79](https://github.com/invertase/react-native-google-mobile-ads/commit/b848e79eabb90fcfdea410c7445b086cff6fabb7))
* **ios:** require bound identity before draining interaction locks ([7b8be1f](https://github.com/invertase/react-native-google-mobile-ads/commit/7b8be1fa5cd8acc4444f0c10443b4953802fd1b7))
* **ios:** resolve the window through the scene instead of the app delegate ([0e6d709](https://github.com/invertase/react-native-google-mobile-ads/commit/0e6d709bc18534dafeaf018b89fdf318b9d87b3d)), closes [#908](https://github.com/invertase/react-native-google-mobile-ads/issues/908)
* **ios:** restore Codegen trailing whitespace in Spec.mm ([2cf95b8](https://github.com/invertase/react-native-google-mobile-ads/commit/2cf95b883cb421b35edd129d8f5156dca1664366))
* **ios:** restore userInteractionEnabled after NativeAsset Fabric recycle ([98404d5](https://github.com/invertase/react-native-google-mobile-ads/commit/98404d506ca06d9126509681d79a7da5b4d7b2ad))
* **ios:** seal presented identity after first capture attempt ([5d805fd](https://github.com/invertase/react-native-google-mobile-ads/commit/5d805fd19685875c0be91d18dba8ee66ac526c9e))
* **ios:** wait briefly for Info.plist in RNGoogleMobileAds config script ([6f7b873](https://github.com/invertase/react-native-google-mobile-ads/commit/6f7b873043093e90a1598604fd766bcc7c6bfd02))
* **native-ad:** re-register NativeAsset when FlatList rebinds responseId ([2fb42e9](https://github.com/invertase/react-native-google-mobile-ads/commit/2fb42e9bca91d1d097f208474e1d20f6f454aa5b))

## [Unreleased]

### Features

* **facebook:** expose `setAdvertiserTrackingEnabled` / `setDataProcessingOptions` before GMA initialize ([#828](https://github.com/invertase/react-native-google-mobile-ads/issues/828))

### Bug Fixes

* **android:** keep hardware BACK for React Navigation when `<BannerAd>` is mounted ([#813](https://github.com/invertase/react-native-google-mobile-ads/issues/813))
* **plugin:** warn on unknown Expo config plugin keys (including ignored Meta `meta*` options) ([#828](https://github.com/invertase/react-native-google-mobile-ads/issues/828))

### Documentation

* **displaying-ads:** document Android host UI flicker after fullscreen dismiss as AdActivity resume / insets (not package window flags) ([#732](https://github.com/invertase/react-native-google-mobile-ads/issues/732))
* **displaying-ads:** document Android rewarded close / progress chrome under high-engagement as upstream AdActivity / creative UI ([#743](https://github.com/invertase/react-native-google-mobile-ads/issues/743))
* **mediation:** document Pangle dual-host / iOS creative Auto Layout conflicts; core `destroy()` already covers lifecycle ([#738](https://github.com/invertase/react-native-google-mobile-ads/issues/738))
* **mediation:** document Meta Audience Network iOS process-start abort as upstream FAN / adapter ([#783](https://github.com/invertase/react-native-google-mobile-ads/issues/783))
* **native-ads:** document Android `armeabi-v7a` TurboModule EventEmitter crash as upstream React Native ([#771](https://github.com/invertase/react-native-google-mobile-ads/issues/771), [#757](https://github.com/invertase/react-native-google-mobile-ads/issues/757), [#754](https://github.com/invertase/react-native-google-mobile-ads/issues/754))

## [17.2.0](https://github.com/invertase/react-native-google-mobile-ads/compare/v17.1.0...v17.2.0) (2026-09-25)
