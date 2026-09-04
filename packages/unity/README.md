# `@react-native-google-mobile-ads/unity`

Unity Ads **Google Ad Manager / AdMob mediation** adapter package for [`react-native-google-mobile-ads`](https://github.com/invertase/react-native-google-mobile-ads).

This package links Google’s official Unity Ads mediation adapter on Android and iOS. It does **not** ship AppLovin MAX, CloudX, or any JS ad APIs — use core `initialize()` / adapter status for discovery.

## Install

```bash
yarn add @react-native-google-mobile-ads/unity
# peer: react-native-google-mobile-ads
```

Autolinking pulls in the native mediation artifacts. Rebuild the app after install.

## Native adapter class names (GAM / AdMob UI)

| Platform | Class name |
| -------- | ---------- |
| Android | `com.google.ads.mediation.unity.UnityMediationAdapter` |
| iOS | `GADMediationAdapterUnity` |

Also exported from JS:

```ts
import {
  nativeAdapterClassName,
  networkSlug,
} from '@react-native-google-mobile-ads/unity';
```

## Mediation dependencies (pinned in this package)

| Platform | Coordinate | Version pin |
| -------- | ---------- | ----------- |
| Android | `com.google.ads.mediation:unity` | `4.20.0.1` |
| iOS | CocoaPods `GoogleMobileAdsMediationUnity` | `4.20.0.0` |

Citations (verify at upgrade time):

- Android (GAM): https://developers.google.com/ad-manager/mobile-ads-sdk/android/mediation/unity
- iOS (GAM): https://developers.google.com/ad-manager/mobile-ads-sdk/ios/mediation/unity
- CocoaPods: https://cocoapods.org/pods/GoogleMobileAdsMediationUnity

Core continues to own `play-services-ads` / `Google-Mobile-Ads-SDK`. This package does not re-pin the GMA SDK.

iOS platform floor is **13.0** (Unity Ads mediation guide / adapter changelog since `4.16.0.0`).

## Expo (optional)

```js
// app.json / app.config.js plugins
[
  '@react-native-google-mobile-ads/unity',
  {
    // Pass Unity Ads SKAdNetwork IDs from Unity’s current docs
    skAdNetworkItems: [/* ... */],
  },
]
```

App IDs stay in the core Expo plugin.

## Out of scope

- AppLovin MAX host SDK
- CloudX / other non-GAM hosts
- Fyber/DT Exchange (no Google GAM adapter — do not invent)
