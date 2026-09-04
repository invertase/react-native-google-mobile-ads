# `@react-native-google-mobile-ads/pangle`

Pangle (ByteDance) **Google Ad Manager / AdMob mediation** adapter package for [`react-native-google-mobile-ads`](https://github.com/invertase/react-native-google-mobile-ads).

This package links Google’s official Pangle mediation adapter on Android and iOS. It does **not** ship AppLovin MAX, CloudX, or any JS ad APIs — use core `initialize()` / adapter status for discovery.

## Install

```bash
yarn add @react-native-google-mobile-ads/pangle
# peer: react-native-google-mobile-ads
```

Autolinking pulls in the native mediation artifacts. Rebuild the app after install.

### Android Maven repository (required)

Google’s Pangle GAM adapter depends on `com.pangle.global:pag-sdk`, which is hosted on ByteDance Maven (not Maven Central). This package adds that repository in its Android module. If your app uses `dependencyResolutionManagement` / `FAIL_ON_PROJECT_REPOS`, also add the repo in your project `settings.gradle(.kts)` as shown in Google’s guide:

```kotlin
maven {
  url = uri("https://artifact.bytedance.com/repository/pangle/")
}
```

## Native adapter class names (GAM / AdMob UI)

| Platform | Class name |
| -------- | ---------- |
| Android | `com.google.ads.mediation.pangle.PangleMediationAdapter` |
| iOS | `GADMediationAdapterPangle` |

Also exported from JS:

```ts
import {
  nativeAdapterClassName,
  networkSlug,
} from '@react-native-google-mobile-ads/pangle';
```

## Mediation dependencies (pinned in this package)

| Platform | Coordinate | Version pin |
| -------- | ---------- | ----------- |
| Android | `com.google.ads.mediation:pangle` | `8.2.0.4.0` |
| iOS | CocoaPods `GoogleMobileAdsMediationPangle` | `8.2.1.0.0` |

Citations (verify at upgrade time):

- Android (GAM): https://developers.google.com/ad-manager/mobile-ads-sdk/android/mediation/pangle
- iOS (GAM): https://developers.google.com/ad-manager/mobile-ads-sdk/ios/mediation/pangle
- CocoaPods: https://cocoapods.org/pods/GoogleMobileAdsMediationPangle

Core continues to own `play-services-ads` / `Google-Mobile-Ads-SDK`. This package does not re-pin the GMA SDK.

iOS platform floor is **13.0** (Pangle mediation guide prerequisites / CocoaPods podspec).

## Expo (optional)

```js
// app.json / app.config.js plugins
[
  '@react-native-google-mobile-ads/pangle',
  {
    // Pass Pangle SKAdNetwork IDs from Pangle’s current docs
    skAdNetworkItems: [/* ... */],
  },
]
```

App IDs stay in the core Expo plugin.

## Out of scope

- AppLovin MAX host SDK
- CloudX / other non-GAM hosts
- Fyber/DT Exchange (no Google GAM adapter — do not invent)
