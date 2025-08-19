### [15.4.2](https://github.com/invertase/react-native-google-mobile-ads/compare/v15.4.1...v15.4.2) (2025-08-19)


### Bug Fixes

* **android:** native ad enum bindings (split from [#782](https://github.com/invertase/react-native-google-mobile-ads/issues/782)) ([574c479](https://github.com/invertase/react-native-google-mobile-ads/commit/574c479b0f4626b0b77ecd92f51274efabffca75))
* **iOS:** wrong property being extracted in native ad (split from [#782](https://github.com/invertase/react-native-google-mobile-ads/issues/782)) ([8a6a13d](https://github.com/invertase/react-native-google-mobile-ads/commit/8a6a13d3c075626520acd151d80f4dcecabd3e97))
* passing native ad request options to native side (split from [#782](https://github.com/invertase/react-native-google-mobile-ads/issues/782)) ([d6ef5e2](https://github.com/invertase/react-native-google-mobile-ads/commit/d6ef5e24013272757f84672b671641e032b5fcf7))

### [15.4.1](https://github.com/invertase/react-native-google-mobile-ads/compare/v15.4.0...v15.4.1) (2025-08-18)


### Bug Fixes

* support of react-native 0.81 for Android ([db8d098](https://github.com/invertase/react-native-google-mobile-ads/commit/db8d0989bbdb2cfc78c3d56421d76332c8fc5ca9))

## [15.4.0](https://github.com/invertase/react-native-google-mobile-ads/compare/v15.3.1...v15.4.0) (2025-06-07)


### Features

* **banner:** Support maximum height for Inline Adaptive banners ([017ffbf](https://github.com/invertase/react-native-google-mobile-ads/commit/017ffbff9ec2f4f6e0e9f0eb260b09e2232f4a54))

### [15.3.1](https://github.com/invertase/react-native-google-mobile-ads/compare/v15.3.0...v15.3.1) (2025-05-24)


### Bug Fixes

* **expo:** make the config plugin idempotent ([67b30da](https://github.com/invertase/react-native-google-mobile-ads/commit/67b30da31d0b1f22a6c8ceab5cb996894ef7f2ef))

## [15.3.0](https://github.com/invertase/react-native-google-mobile-ads/compare/v15.2.0...v15.3.0) (2025-05-23)


### Features

* **deps:** update mobile ads sdk - ios 12.4.0 android 24.3.0 ([57a91ce](https://github.com/invertase/react-native-google-mobile-ads/commit/57a91ce966927531befea3f8a34f56130e6345ed))

## [15.2.0](https://github.com/invertase/react-native-google-mobile-ads/compare/v15.1.0...v15.2.0) (2025-04-30)


### Features

* **deps:** update mobile ads sdk - ios 12.3.0 ([1934f80](https://github.com/invertase/react-native-google-mobile-ads/commit/1934f8064d2d53d5bfef3d0c286848bdefe409be))

## [15.1.0](https://github.com/invertase/react-native-google-mobile-ads/compare/v15.0.0...v15.1.0) (2025-04-15)


### Features

* **deps:** update mobile ads sdk - android 24.2.0 ([1f71d9c](https://github.com/invertase/react-native-google-mobile-ads/commit/1f71d9ccf423db896bcc2405881f34b77e1796a4))

## [15.0.0](https://github.com/invertase/react-native-google-mobile-ads/compare/v14.11.0...v15.0.0) (2025-03-23)


### ⚠ BREAKING CHANGES

* **deps:** requires kotlin 2.1.0

### Features

* **deps:** update mobile ads sdk - android 24.1.0 ([52a4e67](https://github.com/invertase/react-native-google-mobile-ads/commit/52a4e671e6daf72c55aca90b1a8c7370ca3aa437))

## [14.11.0](https://github.com/invertase/react-native-google-mobile-ads/compare/v14.10.1...v14.11.0) (2025-03-23)


### Features

* **deps:** update mobile ads sdk - ios 12.2.0 ([c88d8c0](https://github.com/invertase/react-native-google-mobile-ads/commit/c88d8c00901f555187cf15eb6dea50f3cc1167a6))


### Bug Fixes

* Revert "feat(deps): update mobile ads sdk - ios 12.2.0 android 24.1.0" ([f26a903](https://github.com/invertase/react-native-google-mobile-ads/commit/f26a903985ae61384dff780a41cb1d08c4bf31e9))
* Revert "Revert "fix: resolve AndroidManifest conflict for AD_SERVICES_CONFIG ([#660](https://github.com/invertase/react-native-google-mobile-ads/issues/660))"" ([972f432](https://github.com/invertase/react-native-google-mobile-ads/commit/972f432e33a8b3643e3636bb9b29d41d274f7a16))

### [14.10.1](https://github.com/invertase/react-native-google-mobile-ads/compare/v14.10.0...v14.10.1) (2025-03-15)


### Bug Fixes

* **docs:** small grammar fixes ([234a6bb](https://github.com/invertase/react-native-google-mobile-ads/commit/234a6bbdfcdd603f3b545dcce0c5a8a701c022fe))
* **docs:** typos ([5989fbf](https://github.com/invertase/react-native-google-mobile-ads/commit/5989fbf3059efef35521179595ffa8cba59776ec))
* in sdk 24.0.0 OPTIMIZE_INITIALIZATION and OPTIMIZE_AD_LOADING are set to true by default ([b6be994](https://github.com/invertase/react-native-google-mobile-ads/commit/b6be994620fe73d924cffc6ab816d17515280535))


### Reverts

* Revert "fix: resolve AndroidManifest conflict for AD_SERVICES_CONFIG (#660)" ([ebe1d1d](https://github.com/invertase/react-native-google-mobile-ads/commit/ebe1d1d2fb94867638d88cd2e721ddb7cff75632)), closes [#660](https://github.com/invertase/react-native-google-mobile-ads/issues/660)

## [14.10.0](https://github.com/invertase/react-native-google-mobile-ads/compare/v14.9.1...v14.10.0) (2025-03-15)


### Features

* **deps:** update mobile ads sdk - ios 12.2.0 android 24.1.0 ([9287eaa](https://github.com/invertase/react-native-google-mobile-ads/commit/9287eaadbedd454d43a2594cdc7ac049ce1e9403))


### Bug Fixes

* **docs:** typos ([5989fbf](https://github.com/invertase/react-native-google-mobile-ads/commit/5989fbf3059efef35521179595ffa8cba59776ec))
* in sdk 24.0.0 OPTIMIZE_INITIALIZATION and OPTIMIZE_AD_LOADING are set to true by default ([b6be994](https://github.com/invertase/react-native-google-mobile-ads/commit/b6be994620fe73d924cffc6ab816d17515280535))


### Reverts

* Revert "fix: resolve AndroidManifest conflict for AD_SERVICES_CONFIG (#660)" ([ebe1d1d](https://github.com/invertase/react-native-google-mobile-ads/commit/ebe1d1d2fb94867638d88cd2e721ddb7cff75632)), closes [#660](https://github.com/invertase/react-native-google-mobile-ads/issues/660)

## [14.10.0](https://github.com/invertase/react-native-google-mobile-ads/compare/v14.9.1...v14.10.0) (2025-03-15)


### Features

* **deps:** update mobile ads sdk - ios 12.2.0 android 24.1.0 ([9287eaa](https://github.com/invertase/react-native-google-mobile-ads/commit/9287eaadbedd454d43a2594cdc7ac049ce1e9403))


### Bug Fixes

* in sdk 24.0.0 OPTIMIZE_INITIALIZATION and OPTIMIZE_AD_LOADING are set to true by default ([b6be994](https://github.com/invertase/react-native-google-mobile-ads/commit/b6be994620fe73d924cffc6ab816d17515280535))


### Reverts

* Revert "fix: resolve AndroidManifest conflict for AD_SERVICES_CONFIG (#660)" ([ebe1d1d](https://github.com/invertase/react-native-google-mobile-ads/commit/ebe1d1d2fb94867638d88cd2e721ddb7cff75632)), closes [#660](https://github.com/invertase/react-native-google-mobile-ads/issues/660)

### [14.9.1](https://github.com/invertase/react-native-google-mobile-ads/compare/v14.9.0...v14.9.1) (2025-02-26)


### Bug Fixes

* **android:** fix for android build on RN77 ([39e3f7d](https://github.com/invertase/react-native-google-mobile-ads/commit/39e3f7d0d67ed866a8e56bfa6a846d7fa86c1f9f))

## [14.9.0](https://github.com/invertase/react-native-google-mobile-ads/compare/v14.8.1...v14.9.0) (2025-02-04)


### Features

* **ios:** update mobile ads sdk to 12.0.0 with source code changes ([a716c32](https://github.com/invertase/react-native-google-mobile-ads/commit/a716c325ed0611282772d304d050718e808a8aeb))

### [14.8.1](https://github.com/invertase/react-native-google-mobile-ads/compare/v14.8.0...v14.8.1) (2025-01-23)


### Bug Fixes

* **ios:** register asset view properly in old arch ([b1ea6c1](https://github.com/invertase/react-native-google-mobile-ads/commit/b1ea6c1046546508c90238b2c61cf4251d2c07db))

## [14.8.0](https://github.com/invertase/react-native-google-mobile-ads/compare/v14.7.2...v14.8.0) (2024-12-30)


### Features

* Initial Native Ad Support ([f68d987](https://github.com/invertase/react-native-google-mobile-ads/commit/f68d987bcf2ae2fee1abe133efd096095b514f31))

### [14.7.2](https://github.com/invertase/react-native-google-mobile-ads/compare/v14.7.1...v14.7.2) (2024-12-18)


### Bug Fixes

* gatherConsent missing options, remove js helpers from native module spec ([46145b9](https://github.com/invertase/react-native-google-mobile-ads/commit/46145b9abe2a2d6c3a1456ac3e8b265cca49c30a))

### [14.7.1](https://github.com/invertase/react-native-google-mobile-ads/compare/v14.7.0...v14.7.1) (2024-12-12)


### Bug Fixes

* warning requiresMainQueueSetup ([b6c2ee7](https://github.com/invertase/react-native-google-mobile-ads/commit/b6c2ee7eed3d1967f49f7a2212d58cf1c1af9a38))

## [14.7.0](https://github.com/invertase/react-native-google-mobile-ads/compare/v14.6.0...v14.7.0) (2024-12-11)


### Features

* update mobile ads sdk, ump sdk and add new geography options ([8562627](https://github.com/invertase/react-native-google-mobile-ads/commit/8562627818c5bb4a9dc735a32b26282f9b3f56ae))

## [14.6.0](https://github.com/invertase/react-native-google-mobile-ads/compare/v14.5.0...v14.6.0) (2024-12-09)


### Features

* **ios:** precision constants on new arch ([1a503f2](https://github.com/invertase/react-native-google-mobile-ads/commit/1a503f2bac3e86e825d9052df0576c18abf60a36))
* **ios:** UMP consent SDK on new arch ([19e9379](https://github.com/invertase/react-native-google-mobile-ads/commit/19e9379a80a3cfe597aacf7ce2e6bad49e82dcb9))

## [14.5.0](https://github.com/invertase/react-native-google-mobile-ads/compare/v14.4.3...v14.5.0) (2024-12-03)


### Features

* **ios:** full screen ads on new arch ([4e1cf8f](https://github.com/invertase/react-native-google-mobile-ads/commit/4e1cf8f23152358b97196250c615e5b225506994))

### [14.4.3](https://github.com/invertase/react-native-google-mobile-ads/compare/v14.4.2...v14.4.3) (2024-12-02)


### Bug Fixes

* **android:** use currentActivity in initialize if !null, aids use of mediation adapters ([#664](https://github.com/invertase/react-native-google-mobile-ads/issues/664)) ([410bcdc](https://github.com/invertase/react-native-google-mobile-ads/commit/410bcdc7917e3ba21567020f84bcfffb3513edfc))

### [14.4.2](https://github.com/invertase/react-native-google-mobile-ads/compare/v14.4.1...v14.4.2) (2024-11-24)


### Bug Fixes

* resolve AndroidManifest conflict for AD_SERVICES_CONFIG ([#660](https://github.com/invertase/react-native-google-mobile-ads/issues/660)) ([831bb8f](https://github.com/invertase/react-native-google-mobile-ads/commit/831bb8f0541b71dddd6cfd6b04f09c235604699a))

### [14.4.1](https://github.com/invertase/react-native-google-mobile-ads/compare/v14.4.0...v14.4.1) (2024-11-23)


### Bug Fixes

* missing default requestagent ([d56ac12](https://github.com/invertase/react-native-google-mobile-ads/commit/d56ac12ffae5a5711701a9c2e3650d83333db87e))

## [14.4.0](https://github.com/invertase/react-native-google-mobile-ads/compare/v14.3.1...v14.4.0) (2024-11-15)


### Features

* gather consent method to make user consent easier ([#654](https://github.com/invertase/react-native-google-mobile-ads/issues/654)) ([9a9e5e5](https://github.com/invertase/react-native-google-mobile-ads/commit/9a9e5e5d5d8abfaaa4d2339d16a14db3ff4cf1a0))

### [14.3.1](https://github.com/invertase/react-native-google-mobile-ads/compare/v14.3.0...v14.3.1) (2024-11-13)


### Bug Fixes

* **android:** disable coalescing of native events ([#646](https://github.com/invertase/react-native-google-mobile-ads/issues/646)) ([fce51b1](https://github.com/invertase/react-native-google-mobile-ads/commit/fce51b19477dda8e2bd2c4b3bcf29dacb36efd16))

## [14.3.0](https://github.com/invertase/react-native-google-mobile-ads/compare/v14.2.5...v14.3.0) (2024-11-12)


### Features

* get purpose legitimate interests ([#653](https://github.com/invertase/react-native-google-mobile-ads/issues/653)) ([f711a2c](https://github.com/invertase/react-native-google-mobile-ads/commit/f711a2c1e399dea8344e73ebc64cb27f4426f195))

### [14.2.5](https://github.com/invertase/react-native-google-mobile-ads/compare/v14.2.4...v14.2.5) (2024-10-08)


### Bug Fixes

* type tests were messing with type generation ([#643](https://github.com/invertase/react-native-google-mobile-ads/issues/643)) ([63bbb54](https://github.com/invertase/react-native-google-mobile-ads/commit/63bbb5431a02487f5ea13f72ace601ffed9f7204))

### [14.2.4](https://github.com/invertase/react-native-google-mobile-ads/compare/v14.2.3...v14.2.4) (2024-10-07)


### Bug Fixes

* **android:** fixup java->kotlin transition from 622 ([e62bcb4](https://github.com/invertase/react-native-google-mobile-ads/commit/e62bcb421bf63da63df0f4a9f7a2f23e28f75395))
* jest setup was voiding custom turbo mocks ([#636](https://github.com/invertase/react-native-google-mobile-ads/issues/636)) ([8866d8a](https://github.com/invertase/react-native-google-mobile-ads/commit/8866d8a349be8169588ad9834fb501a31047ced6))

### [14.2.3](https://github.com/invertase/react-native-google-mobile-ads/compare/v14.2.2...v14.2.3) (2024-08-23)


### Bug Fixes

* set default internal request agent ([#632](https://github.com/invertase/react-native-google-mobile-ads/issues/632)) ([cbaeb12](https://github.com/invertase/react-native-google-mobile-ads/commit/cbaeb12583369a67d3818e32ab277c8e3db42d26))

### [14.2.2](https://github.com/invertase/react-native-google-mobile-ads/compare/v14.2.1...v14.2.2) (2024-08-09)


### Bug Fixes

* hotfix building without an app.json file ([fe0f4f2](https://github.com/invertase/react-native-google-mobile-ads/commit/fe0f4f2285b7da5a14cb7d8dd88c501efa3505c4))

### [14.2.1](https://github.com/invertase/react-native-google-mobile-ads/compare/v14.2.0...v14.2.1) (2024-07-26)


### Bug Fixes

* expo managed project detection ([79acdc2](https://github.com/invertase/react-native-google-mobile-ads/commit/79acdc230bff5dd12d44b269f7dadd485a40496e))

## [14.2.0](https://github.com/invertase/react-native-google-mobile-ads/compare/v14.1.0...v14.2.0) (2024-07-23)


### Features

* **video:** add support for video ad volume control ([c1d821d](https://github.com/invertase/react-native-google-mobile-ads/commit/c1d821d82c546e4e00db4865f9c3159cb7bcd495))

## [14.1.0](https://github.com/invertase/react-native-google-mobile-ads/compare/v14.0.1...v14.1.0) (2024-07-16)


### Features

* **deps:** mobile ads sdk upgrade - ios 11.7.0 android 23.2.0 ([5f0486f](https://github.com/invertase/react-native-google-mobile-ads/commit/5f0486f4fd10f59cfdf094617107abfeed90e9c3))

### [14.0.1](https://github.com/invertase/react-native-google-mobile-ads/compare/v14.0.0...v14.0.1) (2024-07-12)


### Bug Fixes

* **android:** replace deprecated onCatalystInstanceDestroy method ([816c269](https://github.com/invertase/react-native-google-mobile-ads/commit/816c2691d0c3f511e8f5af66e5a44493e80ea95b))

## [14.0.0](https://github.com/invertase/react-native-google-mobile-ads/compare/v13.6.1...v14.0.0) (2024-07-12)


### ⚠ BREAKING CHANGES

* Add expo config plugin

### Features

* Add expo config plugin ([848348f](https://github.com/invertase/react-native-google-mobile-ads/commit/848348f747d711a9eeea5a4ed9ede6e4b0e90d45))

### [13.6.1](https://github.com/invertase/react-native-google-mobile-ads/compare/v13.6.0...v13.6.1) (2024-07-04)


### Bug Fixes

* **android:** commands mapped incorrectly ([cf9ee6e](https://github.com/invertase/react-native-google-mobile-ads/commit/cf9ee6ef93ec635c738f7dc2420ace67ffa52fdd))

## [13.6.0](https://github.com/invertase/react-native-google-mobile-ads/compare/v13.5.0...v13.6.0) (2024-07-04)


### Features

* make reloading a banner on foreground easier with a hook ([af5ca02](https://github.com/invertase/react-native-google-mobile-ads/commit/af5ca02702a1a9fa3c6efbd0788aed24ebb3f91c))


### Bug Fixes

* **types:** update react-native dev dep, forward-port typings ([dbb0208](https://github.com/invertase/react-native-google-mobile-ads/commit/dbb0208d19cbb88be2069689dba258cd0edf7e04))


### Performance Improvements

* **ci:** avoid big globs in hashFiles ([3093345](https://github.com/invertase/react-native-google-mobile-ads/commit/3093345f12a37e4c3c9cf85d83ddf18f13796690))

## [13.5.0](https://github.com/invertase/react-native-google-mobile-ads/compare/v13.4.0...v13.5.0) (2024-05-21)


### Features

* add method to reload banner ad ([2a57487](https://github.com/invertase/react-native-google-mobile-ads/commit/2a574874624af515d6ecfc8819385ab4c6c73912))

## [13.4.0](https://github.com/invertase/react-native-google-mobile-ads/compare/v13.3.1...v13.4.0) (2024-05-20)


### Features

* **deps:** mobile ads sdk upgrade - ios 11.5.0 android 23.1.0 ([a34c7ba](https://github.com/invertase/react-native-google-mobile-ads/commit/a34c7bae6e8f607f9fe22c8f63264600662a3dd8))

### [13.3.1](https://github.com/invertase/react-native-google-mobile-ads/compare/v13.3.0...v13.3.1) (2024-05-19)


### Bug Fixes

* topNative name changed to topNativeEvent. ([b4cbea3](https://github.com/invertase/react-native-google-mobile-ads/commit/b4cbea3cbff42bdae7a630bd7daf03ebb1fca49c))
* Typescript error in the docs ([4ad8bc7](https://github.com/invertase/react-native-google-mobile-ads/commit/4ad8bc7a967040eecc60a2ad631bc14c2cada443))

## [13.3.0](https://github.com/invertase/react-native-google-mobile-ads/compare/v13.2.1...v13.3.0) (2024-05-13)


### Features

* **android:** Add support for ArrayList ([7303730](https://github.com/invertase/react-native-google-mobile-ads/commit/7303730a702ff2141be8fd417d7977ccf07f463c))

### [13.2.1](https://github.com/invertase/react-native-google-mobile-ads/compare/v13.2.0...v13.2.1) (2024-05-02)


### Bug Fixes

* **banner, ios:** banner not destroyed in new arch ([2d8bdb5](https://github.com/invertase/react-native-google-mobile-ads/commit/2d8bdb562c9ecd968e11bad73310874ecf5b82ec))
* **banner, ios:** fixed memory leak ([5cbf0e9](https://github.com/invertase/react-native-google-mobile-ads/commit/5cbf0e9f785107a33e5b3569c13cff5e5d186c8a))

## [13.2.0](https://github.com/invertase/react-native-google-mobile-ads/compare/v13.1.0...v13.2.0) (2024-04-03)


### Features

* add FLUID size support ([c09a326](https://github.com/invertase/react-native-google-mobile-ads/commit/c09a3267ecfbedc9b7ad66f68967e480e9fe09ad))


### Bug Fixes

* android build error 'onAdLoaded' overrides nothing ([bd52c12](https://github.com/invertase/react-native-google-mobile-ads/commit/bd52c12b2c9edbf92a809f814a0c1b4ca8b3e492))

## [13.1.0](https://github.com/invertase/react-native-google-mobile-ads/compare/v13.0.2...v13.1.0) (2024-03-26)


### Features

* **deps:** mobile ads sdk upgrade - ios 11.2.0 android 23.0.0 ([099add4](https://github.com/invertase/react-native-google-mobile-ads/commit/099add4c2dc7c16542a14f962dd87e4fc8b28ce5))

### [13.0.2](https://github.com/invertase/react-native-google-mobile-ads/compare/v13.0.1...v13.0.2) (2024-03-05)


### Bug Fixes

* TestIds.ADAPTIVE_BANNER undefined type error ([ffbc7b1](https://github.com/invertase/react-native-google-mobile-ads/commit/ffbc7b1d4b667c629f578b17020f99bbb1512a00))

### [13.0.1](https://github.com/invertase/react-native-google-mobile-ads/compare/v13.0.0...v13.0.1) (2024-02-22)


### Bug Fixes

* to support app privacy manifests, cocoapods has to be at >= 1.12.0 ([ac8e06e](https://github.com/invertase/react-native-google-mobile-ads/commit/ac8e06ed8c79b54881452484060021c18525f2c1))

## [13.0.0](https://github.com/invertase/react-native-google-mobile-ads/compare/v12.11.0...v13.0.0) (2024-02-22)


### ⚠ BREAKING CHANGES

* **deps:** mobile ads sdk upgrade - ios 11.0.1, ump sdk 2.2.0

### Features

* **deps:** mobile ads sdk upgrade - ios 11.0.1, ump sdk 2.2.0 ([d924586](https://github.com/invertase/react-native-google-mobile-ads/commit/d9245868f8daeb7273a50d5315131be4134ad9be))

## [12.11.0](https://github.com/invertase/react-native-google-mobile-ads/compare/v12.10.0...v12.11.0) (2024-02-19)


### Features

* **android:** potentially improves mediation performance for banners ([#527](https://github.com/invertase/react-native-google-mobile-ads/issues/527)) ([32f550a](https://github.com/invertase/react-native-google-mobile-ads/commit/32f550a54a073c7c0c49278364c21cb4a1df994e))


### Bug Fixes

* **consent:** the package returns the wrong value for consent for 'Create a personalized content profile' purpose ([7aef863](https://github.com/invertase/react-native-google-mobile-ads/commit/7aef86346fa2a5205e24035bc53c6dfa80b843d9))

## [12.10.0](https://github.com/invertase/react-native-google-mobile-ads/compare/v12.9.0...v12.10.0) (2024-01-11)


### Features

* add method to check if consent for purpose 1 was given ([8fcee30](https://github.com/invertase/react-native-google-mobile-ads/commit/8fcee30bd72ac74b50abb901a789a6f8a4944f2f))

## [12.9.0](https://github.com/invertase/react-native-google-mobile-ads/compare/v12.8.0...v12.9.0) (2024-01-09)


### Features

* **ios, android:** Add support for app.config.js ([#517](https://github.com/invertase/react-native-google-mobile-ads/issues/517)) ([be39d5a](https://github.com/invertase/react-native-google-mobile-ads/commit/be39d5a03ec8057bd583ca2106beed206b1257cd))


### Reverts

* Revert "chore(docs): update gathering consent info" ([a82412b](https://github.com/invertase/react-native-google-mobile-ads/commit/a82412b83b492a6712979aa16d7bd0302c914654))

## [12.8.0](https://github.com/invertase/react-native-google-mobile-ads/compare/v12.7.1...v12.8.0) (2024-01-03)


### Features

* add method to check if gdpr applies ([011d68d](https://github.com/invertase/react-native-google-mobile-ads/commit/011d68d299a5ad88a13e7628b3d60d97c60380f4))

### [12.7.1](https://github.com/invertase/react-native-google-mobile-ads/compare/v12.7.0...v12.7.1) (2023-12-31)


### Bug Fixes

* banners not properly destroyed ([ef85d87](https://github.com/invertase/react-native-google-mobile-ads/commit/ef85d875cb15f3414995e83382a34679d5d7af9b))

## [12.7.0](https://github.com/invertase/react-native-google-mobile-ads/compare/v12.6.0...v12.7.0) (2023-12-30)


### Features

* initialize sdk in parallel ([3a427ee](https://github.com/invertase/react-native-google-mobile-ads/commit/3a427ee25600c51816016f74c2bfc35c0cb059b9))

## [12.6.0](https://github.com/invertase/react-native-google-mobile-ads/compare/v12.5.1...v12.6.0) (2023-12-05)


### Features

* collapsible banner ads (beta) ([345aaae](https://github.com/invertase/react-native-google-mobile-ads/commit/345aaaebf8ed389861173dda435685cb59c85233))


### Bug Fixes

* remove redundant requestPersonalizedAdsOnly from docs (replaced by UMP) ([79468a7](https://github.com/invertase/react-native-google-mobile-ads/commit/79468a75e7b9e4d48dda9302116a6c5738d570b3))

### [12.5.1](https://github.com/invertase/react-native-google-mobile-ads/compare/v12.5.0...v12.5.1) (2023-12-05)


### Bug Fixes

* update demo ad ids ([324c213](https://github.com/invertase/react-native-google-mobile-ads/commit/324c2133cf988920a8688b6eefb37834c9aa2207))

## [12.5.0](https://github.com/invertase/react-native-google-mobile-ads/compare/v12.4.0...v12.5.0) (2023-12-05)


### Features

* **deps:** mobile ads sdk upgrade - ios 10.14.0 android 22.5.0 ([f3a8146](https://github.com/invertase/react-native-google-mobile-ads/commit/f3a8146b6dfc1a0333e5316b914e65b6b1d1148d))

## [12.4.0](https://github.com/invertase/react-native-google-mobile-ads/compare/v12.3.0...v12.4.0) (2023-11-10)


### Features

* exposes impression-level ad revenue events ([969dbfa](https://github.com/invertase/react-native-google-mobile-ads/commit/969dbfac50a4147531e7d06f1fbbf0ea80426c96))

## [12.3.0](https://github.com/invertase/react-native-google-mobile-ads/compare/v12.2.0...v12.3.0) (2023-10-08)


### Features

* **deps, ios:** mobile ads sdk upgrade - ios 10.12.0 ([6c86072](https://github.com/invertase/react-native-google-mobile-ads/commit/6c86072310867977bd77170ace91ca0f2f8b5653))

## [12.2.0](https://github.com/invertase/react-native-google-mobile-ads/compare/v12.1.2...v12.2.0) (2023-09-25)


### Features

* **deps:** mobile ads sdk upgrade - ios 10.10.0 android 22.4.0 ([96b2450](https://github.com/invertase/react-native-google-mobile-ads/commit/96b24509e476f62373d6b98b0bce62caf27e6c1e))

### [12.1.2](https://github.com/invertase/react-native-google-mobile-ads/compare/v12.1.1...v12.1.2) (2023-09-11)


### Bug Fixes

* **android:** crash when activity context not available ([7c89579](https://github.com/invertase/react-native-google-mobile-ads/commit/7c8957907f3237ebf245e9871e625868d1d77e25))
* **android:** race condition getting current activity ([b3a09e1](https://github.com/invertase/react-native-google-mobile-ads/commit/b3a09e1f77627af7f2cbeb9bdee22541165992a8))

### [12.1.1](https://github.com/invertase/react-native-google-mobile-ads/compare/v12.1.0...v12.1.1) (2023-09-01)


### Bug Fixes

* missing events of type GAMAdEventType in addAdEventListener ([073cc21](https://github.com/invertase/react-native-google-mobile-ads/commit/073cc217df7fd8332a72f98c288798ea26736d8d))

## [12.1.0](https://github.com/invertase/react-native-google-mobile-ads/compare/v12.0.0...v12.1.0) (2023-08-29)


### Features

* **consent:** expose the new loadAndShowConsentFormIfRequired method ([509f9b7](https://github.com/invertase/react-native-google-mobile-ads/commit/509f9b7e8a3fd27108219954e662a3bb8fb23d4c))

## [12.0.0](https://github.com/invertase/react-native-google-mobile-ads/compare/v11.7.0...v12.0.0) (2023-08-13)


### ⚠ BREAKING CHANGES

* Alters the return types of two methods

### Features

* return consent info whenever it changes ([f04ac01](https://github.com/invertase/react-native-google-mobile-ads/commit/f04ac01b9e1455e9d3c12eb20a7e96edef45b346))

## [11.7.0](https://github.com/invertase/react-native-google-mobile-ads/compare/v11.6.5...v11.7.0) (2023-08-07)


### Features

* **deps, ios:** mobile ads sdk upgrade - 10.9.0 ([cb682f3](https://github.com/invertase/react-native-google-mobile-ads/commit/cb682f37fff666488e553b20f755c2b917340b1d))

### [11.6.5](https://github.com/invertase/react-native-google-mobile-ads/compare/v11.6.4...v11.6.5) (2023-08-05)


### Bug Fixes

* banner ad not showing when requestoptions absent ([e0f7982](https://github.com/invertase/react-native-google-mobile-ads/commit/e0f7982fe001de952b9a939ca02878d407d99b6b))

### [11.6.4](https://github.com/invertase/react-native-google-mobile-ads/compare/v11.6.3...v11.6.4) (2023-08-04)


### Bug Fixes

* **ios:** support new arch in rn 0.70 ([589a0fa](https://github.com/invertase/react-native-google-mobile-ads/commit/589a0fa7299286b937292fdec999d3a9644dcf87))

### [11.6.3](https://github.com/invertase/react-native-google-mobile-ads/compare/v11.6.2...v11.6.3) (2023-08-01)


### Bug Fixes

* kotlin version ([fc26606](https://github.com/invertase/react-native-google-mobile-ads/commit/fc26606234dd069d6addf201b6991d7c24d3d558))

### [11.6.2](https://github.com/invertase/react-native-google-mobile-ads/compare/v11.6.1...v11.6.2) (2023-07-31)


### Bug Fixes

* export AdsConsentPrivacyOptionsRequirementStatus ([43988a3](https://github.com/invertase/react-native-google-mobile-ads/commit/43988a3c56a337b5dd9ce53634e63d928ff9bf12))

### [11.6.1](https://github.com/invertase/react-native-google-mobile-ads/compare/v11.6.0...v11.6.1) (2023-07-28)


### Bug Fixes

* **android:** race condition getting current activity ([5a8788b](https://github.com/invertase/react-native-google-mobile-ads/commit/5a8788b2202873b892947aed606ad8b6f792501e))

## [11.6.0](https://github.com/invertase/react-native-google-mobile-ads/compare/v11.5.0...v11.6.0) (2023-07-27)


### Features

* expose showPrivacyOptionsForm method ([284b2f3](https://github.com/invertase/react-native-google-mobile-ads/commit/284b2f375a20768aebed30021ce100bf8d0add89))


### Bug Fixes

* **ios:** Build support on both architectures ([2eac953](https://github.com/invertase/react-native-google-mobile-ads/commit/2eac953baf2d8efe915ef9fbf8bdd7396e707057))

## [11.5.0](https://github.com/invertase/react-native-google-mobile-ads/compare/v11.4.1...v11.5.0) (2023-07-25)


### Features

* google ump sdk upgrade - 2.1.0 ([848986d](https://github.com/invertase/react-native-google-mobile-ads/commit/848986d73e44df641f2ab2718928a7592b8436d9))


### Bug Fixes

* **android:** example app gradle plugin location ([57ec80c](https://github.com/invertase/react-native-google-mobile-ads/commit/57ec80c6c349841ff6fb2f093349d94936f7a827))

### [11.4.1](https://github.com/invertase/react-native-google-mobile-ads/compare/v11.4.0...v11.4.1) (2023-07-25)


### Bug Fixes

* **ios:** incompatible integer to pointer conversion ([e25113d](https://github.com/invertase/react-native-google-mobile-ads/commit/e25113ded42508e364a6d6b9bd46b7e88b612041))

## [11.4.0](https://github.com/invertase/react-native-google-mobile-ads/compare/v11.3.0...v11.4.0) (2023-07-24)


### Features

* **deps:** mobile ads sdk upgrade - ios 10.8.0 android 22.2.0 ([fa0ca9e](https://github.com/invertase/react-native-google-mobile-ads/commit/fa0ca9e54266d7d6bdb1d640b6c3b716a438f0dd))

## [11.3.0](https://github.com/invertase/react-native-google-mobile-ads/compare/v11.2.0...v11.3.0) (2023-07-24)


### Features

* **ios:** sdk methods and banners on new architecture ([3ee9d02](https://github.com/invertase/react-native-google-mobile-ads/commit/3ee9d020eaa5dd6b050d43d8ce72756bf131d9f8))

## [11.2.0](https://github.com/invertase/react-native-google-mobile-ads/compare/v11.1.1...v11.2.0) (2023-07-18)


### Features

* **catalyst:** support building on catalyst, though ads will not work ([#389](https://github.com/invertase/react-native-google-mobile-ads/issues/389)) ([ab55792](https://github.com/invertase/react-native-google-mobile-ads/commit/ab55792673b732f84eeb772a2626d0dc50b85a50))

### [11.1.1](https://github.com/invertase/react-native-google-mobile-ads/compare/v11.1.0...v11.1.1) (2023-06-16)


### Bug Fixes

* **android:** android build error issue fixed for RN 0.72 "Cannot set the value of read-only property 'force' " ([16ad8ec](https://github.com/invertase/react-native-google-mobile-ads/commit/16ad8ec124a14ea2fc7e7c72515a91dfe237f1be))

## [11.1.0](https://github.com/invertase/react-native-google-mobile-ads/compare/v11.0.0...v11.1.0) (2023-06-08)


### Features

* **deps:** mobile ads sdk upgrade - ios 10.6.0 ([fe8ed90](https://github.com/invertase/react-native-google-mobile-ads/commit/fe8ed9094370ea97dbdde464911619c15cb4c694))

## [11.0.0](https://github.com/invertase/react-native-google-mobile-ads/compare/v10.3.2...v11.0.0) (2023-05-30)


### ⚠ BREAKING CHANGES

* Updated minimum supported Xcode version to 14.1.
  * armv7 is not supported in Xcode 14 and has been removed from the SDK.
* The minimum deployment target has been increased to iOS 11.0.

### Features

* **deps:** mobile ads sdk upgrade - ios 10.5.0 android 22.1.0 ([37e5e7d](https://github.com/invertase/react-native-google-mobile-ads/commit/37e5e7d1f44b4671d5961c901abeaf6ea5010426))

### [10.3.2](https://github.com/invertase/react-native-google-mobile-ads/compare/v10.3.1...v10.3.2) (2023-05-03)


### Bug Fixes

* **ios:** no command found ([91ffad4](https://github.com/invertase/react-native-google-mobile-ads/commit/91ffad45b11699f62820b37d7553a516dd9cbd68))

### [10.3.1](https://github.com/invertase/react-native-google-mobile-ads/compare/v10.3.0...v10.3.1) (2023-04-19)


### Bug Fixes

* **ios:** incompatibility with react-native-version ([5ead5f0](https://github.com/invertase/react-native-google-mobile-ads/commit/5ead5f01712e307e7c3c1ef0dfcc6ec6f892fd66))

## [10.3.0](https://github.com/invertase/react-native-google-mobile-ads/compare/v10.2.0...v10.3.0) (2023-04-18)


### Features

* **ios:** add SKAdNetwork identifiers trough app.json ([7ccbb6b](https://github.com/invertase/react-native-google-mobile-ads/commit/7ccbb6b13f800e90bcd2f0a22cc49e85d77d70dc))

## [10.2.0](https://github.com/invertase/react-native-google-mobile-ads/compare/v10.1.3...v10.2.0) (2023-04-14)


### Features

* **deps:** mobile ads sdk upgrade - ios 10.3.0 / android 22.0.0 ([61bee9a](https://github.com/invertase/react-native-google-mobile-ads/commit/61bee9a82b5b520ee542e07d032ddb478836a651))

### [10.1.3](https://github.com/invertase/react-native-google-mobile-ads/compare/v10.1.2...v10.1.3) (2023-04-13)


### Bug Fixes

*  Solved issue with method recordManualImpression for GAMBannerAd ([#363](https://github.com/invertase/react-native-google-mobile-ads/issues/363)) ([a7dbc74](https://github.com/invertase/react-native-google-mobile-ads/commit/a7dbc748d355528f1f7edbdd497736255adcfcc0))

### [10.1.2](https://github.com/invertase/react-native-google-mobile-ads/compare/v10.1.1...v10.1.2) (2023-04-12)


### Bug Fixes

* **android-debug:** use activity for GAM ([984247f](https://github.com/invertase/react-native-google-mobile-ads/commit/984247ff80dab36004bd49c27a20f489e075029b))

### [10.1.1](https://github.com/invertase/react-native-google-mobile-ads/compare/v10.1.0...v10.1.1) (2023-04-09)


### Reverts

* Revert "fix(android banner): debug menu opening" ([19b7e5a](https://github.com/invertase/react-native-google-mobile-ads/commit/19b7e5ab918ce6fe454844489ad33a19e3c8e398))

## [10.1.0](https://github.com/invertase/react-native-google-mobile-ads/compare/v10.0.1...v10.1.0) (2023-04-04)


### Features

* **ads-module:** open debug menu programmatically ([3480f1b](https://github.com/invertase/react-native-google-mobile-ads/commit/3480f1b76ae950b8711db791a46e1a4a396c1bb9))

### [10.0.1](https://github.com/invertase/react-native-google-mobile-ads/compare/v10.0.0...v10.0.1) (2023-03-22)


### Bug Fixes

* **android banner:** debug menu opening ([3b1f34c](https://github.com/invertase/react-native-google-mobile-ads/commit/3b1f34cb850d89555f6350d5c8b50e4c242a3a78))

## [10.0.0](https://github.com/invertase/react-native-google-mobile-ads/compare/v9.1.2...v10.0.0) (2023-03-07)


### ⚠ BREAKING CHANGES

* **deps:** - Ads are no longer served on iOS 11. iOS 12 is required to retrieve ads, though iOS 10 is still supported.
- Building with bitcode is no longer supported. Disabling bitcode in your mobile apps is now required to integrate the Google Mobile Ads SDK (iOS).

### Features

* **deps:** mobile ads sdk upgrade - ios 10.2.0 / android 21.5.0 ([feb7eb3](https://github.com/invertase/react-native-google-mobile-ads/commit/feb7eb341b71c4aaf95ad04a11454ec18638e21c))

### [9.1.2](https://github.com/invertase/react-native-google-mobile-ads/compare/v9.1.1...v9.1.2) (2023-02-22)


### Bug Fixes

* **banner, android:** support props for multiple view instances ([8c61e8b](https://github.com/invertase/react-native-google-mobile-ads/commit/8c61e8bc226cbaa0102abba9dd72697d69166242))

### [9.1.1](https://github.com/invertase/react-native-google-mobile-ads/compare/v9.1.0...v9.1.1) (2023-01-22)


### Bug Fixes

* **banner, ios:** Fix not able to receive banner app event on iOS ([e9ff699](https://github.com/invertase/react-native-google-mobile-ads/commit/e9ff69953161e514e6a1209a7389e2e7c5ce51ab))

## [9.1.0](https://github.com/invertase/react-native-google-mobile-ads/compare/v9.0.0...v9.1.0) (2023-01-13)


### Features

* **deps:** mobile ads SDK upgrade - iOS 9.14.0 / android 21.4.0 ([c81eeb6](https://github.com/invertase/react-native-google-mobile-ads/commit/c81eeb6c3e6f90c5d70ce3c5719f665e5004e86b))

## [9.0.0](https://github.com/invertase/react-native-google-mobile-ads/compare/v8.2.3...v9.0.0) (2023-01-10)


### ⚠ BREAKING CHANGES

* move GAM-exclusive FLUID type to new GAMBanner const

### Bug Fixes

* move GAM-exclusive FLUID type to new GAMBanner const ([85545f6](https://github.com/invertase/react-native-google-mobile-ads/commit/85545f6c2a0b02af3835aabd262632cc1e67172c))

### [8.2.3](https://github.com/invertase/react-native-google-mobile-ads/compare/v8.2.2...v8.2.3) (2023-01-10)


### Bug Fixes

* **ios:** adaptive banner should take safe areas into account ([c34fe1a](https://github.com/invertase/react-native-google-mobile-ads/commit/c34fe1ac9a53e523b906fd2014f3f691d8a3fb00))
* **type:** fixed mobileAds initialize response status type [#515](https://github.com/invertase/react-native-google-mobile-ads/issues/515) ([e0a7d29](https://github.com/invertase/react-native-google-mobile-ads/commit/e0a7d29fd7b5ad5e8f7e054fb3e759058d090c17))

### [8.2.2](https://github.com/invertase/react-native-google-mobile-ads/compare/v8.2.1...v8.2.2) (2022-11-27)


### Bug Fixes

* **ios:** use fully-specified path to required head utility ([fe69aa4](https://github.com/invertase/react-native-google-mobile-ads/commit/fe69aa44e44bec63cff0944b68cc37acde5e7976))

### [8.2.1](https://github.com/invertase/react-native-google-mobile-ads/compare/v8.2.0...v8.2.1) (2022-10-30)


### Bug Fixes

* **deps:** android sdk 21.3.0 / ios sdk 9.12.0 ([dbb9ed3](https://github.com/invertase/react-native-google-mobile-ads/commit/dbb9ed365da3346bf3e4a1c51ad9118f71bff50c))

## [8.2.0](https://github.com/invertase/react-native-google-mobile-ads/compare/v8.1.2...v8.2.0) (2022-10-15)


### Features

* allow load to be called again after error ([066986c](https://github.com/invertase/react-native-google-mobile-ads/commit/066986c0d041f2b2b2ac2818db84915a9e9e8421))

### [8.1.2](https://github.com/invertase/react-native-google-mobile-ads/compare/v8.1.1...v8.1.2) (2022-10-12)


### Bug Fixes

* **android, release:** rewrite helper to avoid reflection / proguard issues ([58839ce](https://github.com/invertase/react-native-google-mobile-ads/commit/58839cea515c2f577737cc1b6aa0a5ff56782085))

### [8.1.1](https://github.com/invertase/react-native-google-mobile-ads/compare/v8.1.0...v8.1.1) (2022-09-29)


### Bug Fixes

* **ios, config:** fix typo in ios_app_id error message ([f0fe8e8](https://github.com/invertase/react-native-google-mobile-ads/commit/f0fe8e81c3de42a1fc85174237482f98e6202770)), closes [#219](https://github.com/invertase/react-native-google-mobile-ads/issues/219)
* **ios:** correctly handle utf-8 chars in ios-config.sh ([d2e1d44](https://github.com/invertase/react-native-google-mobile-ads/commit/d2e1d4456a79d2849f4b2434a73655a7a1a795ed)), closes [#194](https://github.com/invertase/react-native-google-mobile-ads/issues/194)

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
