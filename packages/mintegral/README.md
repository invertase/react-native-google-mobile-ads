# `@react-native-google-mobile-ads/mintegral`

Mintegral **Google Ad Manager / AdMob mediation** adapter package for [`react-native-google-mobile-ads`](https://github.com/invertase/react-native-google-mobile-ads).

This package links Google’s official Mintegral mediation adapter on Android and iOS. It does **not** ship AppLovin MAX, CloudX, or any JS ad APIs — use core `initialize()` / adapter status for discovery.

## Install

```bash
yarn add @react-native-google-mobile-ads/mintegral
# peer: react-native-google-mobile-ads
```

Autolinking pulls in the native mediation artifacts. Rebuild the app after install.

### Android Maven repository (required)

Google’s Mintegral GAM adapter depends on `com.mbridge.msdk.oversea:mbridge_android_sdk`, which is hosted on Mintegral’s Maven (not Maven Central). This package adds that repository in its Android module. If your app uses `dependencyResolutionManagement` / `FAIL_ON_PROJECT_REPOS`, also add the repo in your project `settings.gradle(.kts)` as shown in Google’s guide:

```kotlin
maven {
  url = uri("https://dl-maven-android.mintegral.com/repository/mbridge_android_sdk_oversea")
}
```

## Native adapter class names (GAM / AdMob UI)

| Platform | Class name |
| -------- | ---------- |
| Android | `com.google.ads.mediation.mintegral.MintegralMediationAdapter` |
| iOS | `GADMediationAdapterMintegral` |

Also exported from JS:

```ts
import {
  nativeAdapterClassName,
  networkSlug,
} from '@react-native-google-mobile-ads/mintegral';
```

## Mediation dependencies (pinned in this package)

| Platform | Coordinate | Version pin |
| -------- | ---------- | ----------- |
| Android | `com.google.ads.mediation:mintegral` | `17.1.81.0` |
| iOS | CocoaPods `GoogleMobileAdsMediationMintegral` | `8.1.7.0` |

Citations (verify at upgrade time):

- Android (GAM): https://developers.google.com/ad-manager/mobile-ads-sdk/android/mediation/mintegral
- iOS (GAM): https://developers.google.com/ad-manager/mobile-ads-sdk/ios/mediation/mintegral
- Google Maven: `com.google.ads.mediation:mintegral` (`latest` / `release` = `17.1.81.0`)
- CocoaPods: https://cocoapods.org/pods/GoogleMobileAdsMediationMintegral
- Mintegral Android Maven: `https://dl-maven-android.mintegral.com/repository/mbridge_android_sdk_oversea`

Core continues to own `play-services-ads` / `Google-Mobile-Ads-SDK`. This package does not re-pin the GMA SDK.

iOS platform floor is **13.0** (Mintegral mediation guide prerequisites / CocoaPods podspec). Android minSdk is **23** (guide prerequisites).

## Expo (optional)

```js
// app.json / app.config.js plugins
[
  '@react-native-google-mobile-ads/mintegral',
  {
    // Pass Mintegral SKAdNetwork IDs from Mintegral’s current docs
    skAdNetworkItems: [/* ... */],
  },
]
```

App IDs stay in the core Expo plugin.

## Out of scope

- AppLovin MAX host SDK
- CloudX / other non-GAM hosts
- Fyber/DT Exchange (no Google GAM adapter — do not invent)
