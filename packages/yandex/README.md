# `@react-native-google-mobile-ads/yandex`

Yandex **Google Ad Manager / AdMob mediation** adapter package for [`react-native-google-mobile-ads`](https://github.com/invertase/react-native-google-mobile-ads).

## Platform disposition: iOS-only

Google does **not** publish an open-source / versioned Yandex mediation adapter:

- No CocoaPods `GoogleMobileAdsMediationYandex` ([CocoaPods 404](https://cocoapods.org/pods/GoogleMobileAdsMediationYandex))
- No Maven `com.google.ads.mediation:yandex` (Google Maven 404)
- Yandex is absent from AdMob / GAM [choose ad sources](https://developers.google.com/admob/ios/choose-networks) lists
- Google’s `/mediation/yandex` guide URLs return 404 (AdMob + GAM, Android + iOS)

Character inventory treats the **Yandex GAM adapter as iOS-focused** (Android none), consistent with the Google publication gaps above.

This package therefore ships **iOS only**, linking Yandex’s own published AdMob custom-event adapters — **not** Yandex Mobile Mediation as a host (`GoogleYandexMobileAdsAdapters` / MAX / CloudX are out of scope).

Yandex does publish an Android AdMob adapter (`com.yandex.ads.adapter:admob-mobileads` on Maven Central). It is **not** linked here because Google has no official Android Yandex GAM mediation artifact and Character lists Android coverage for this network as none.

## Install

```bash
yarn add @react-native-google-mobile-ads/yandex
# peer: react-native-google-mobile-ads
```

Autolinking pulls in the iOS mediation pod. Rebuild the app after install. Android autolinking is disabled for this package.

## Native adapter class names (AdMob / GAM UI — custom events)

Yandex is added to AdMob / GAM mediation as a **custom event** (not a single `GADMediationAdapter*` class). Paste the class name for the ad format:

| Platform | Format | Class name |
| -------- | ------ | ---------- |
| iOS | Banner | `YMAAdMobCustomEventBanner` |
| iOS | Interstitial | `YMAAdMobCustomEventInterstitial` |
| iOS | Rewarded | `YMAAdMobCustomEventRewarded` |
| iOS | Native | `YMAAdMobCustomEventNative` |
| Android | — | **not shipped** |

Also exported from JS:

```ts
import {
  nativeAdapterClassName,
  networkSlug,
} from '@react-native-google-mobile-ads/yandex';

// nativeAdapterClassName.android === null
// nativeAdapterClassName.ios.banner === 'YMAAdMobCustomEventBanner'
```

Custom-event parameter JSON (Yandex Ad Unit ID) must still be configured in the AdMob / GAM UI per Yandex’s guide, e.g. `{"adUnitId": "R-M-XXXXXX-X"}`.

## Mediation dependencies (pinned in this package)

| Platform | Coordinate | Version pin |
| -------- | ---------- | ----------- |
| iOS | CocoaPods `YandexMobileAdsAdMobAdapters` | `8.4.0.0` |
| Android | — | **not linked** |

Citations (verify at upgrade time):

- iOS AdMob (Yandex → Google mediation): https://ads.yandex.com/helpcenter/en/dev/ios/admob-third (`pod 'YandexMobileAdsAdMobAdapters', '8.0.0.0'` example; pin uses current CocoaPods Trunk latest)
- CocoaPods: https://cocoapods.org/pods/YandexMobileAdsAdMobAdapters (Trunk latest `8.4.0.0` as of 2026-09-04)
- CocoaPods Specs podspec `8.4.0.0`: depends on `YandexMobileAds ~> 8.4.0`, `Google-Mobile-Ads-SDK ~> 13.6.0`, `platforms.ios` `13.0`
- Android AdMob adapter exists at Maven Central but is **not** used here: https://central.sonatype.com/artifact/com.yandex.ads.adapter/admob-mobileads (`8.4.0.0`); Yandex guide: https://ads.yandex.com/helpcenter/en/dev/android/admob-third
- Do **not** use `GoogleYandexMobileAdsAdapters` — that enables Google **inside Yandex Mobile Mediation** (Yandex-as-host), which is out of RNGMA adapter scope

Core continues to own `play-services-ads` / `Google-Mobile-Ads-SDK`. This package does not re-pin the GMA SDK.

**GMA compatibility note:** `YandexMobileAdsAdMobAdapters@8.4.0.0` requires `Google-Mobile-Ads-SDK ~> 13.6.0`. Core currently pins iOS GMA `13.5.0` — apps that enable this adapter may need a core GMA bump or supported override (same class of pin tension documented for other networks in Character intake).

iOS platform floor is **13.0** (Yandex AdMob adapters podspec).

## Expo (optional)

```js
// app.json / app.config.js plugins
[
  '@react-native-google-mobile-ads/yandex',
  {
    // Pass Yandex SKAdNetwork IDs from Yandex’s current docs
    skAdNetworkItems: [/* ... */],
  },
]
```

App IDs stay in the core Expo plugin.

## Out of scope

- Yandex Mobile Mediation **host** SDK (`YandexMobileAdsMediation`, `GoogleYandexMobileAdsAdapters`)
- AppLovin MAX host SDK
- CloudX / other non-GAM hosts
- Inventing a Google-published Android Yandex GAM artifact
