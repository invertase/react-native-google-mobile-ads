# `@react-native-google-mobile-ads/moloco`

Moloco **Google Ad Manager / AdMob mediation** adapter package for [`react-native-google-mobile-ads`](https://github.com/invertase/react-native-google-mobile-ads).

This package links Google’s official Moloco mediation adapter on Android and iOS. It does **not** ship AppLovin MAX, CloudX, or any JS ad APIs — use core `initialize()` / adapter status for discovery.

## Install

```bash
yarn add @react-native-google-mobile-ads/moloco
# peer: react-native-google-mobile-ads
```

Autolinking pulls in the native mediation artifacts. Rebuild the app after install.

## Native adapter class names (GAM / AdMob UI)

| Platform | Class name |
| -------- | ---------- |
| Android | `com.google.ads.mediation.moloco.MolocoMediationAdapter` |
| iOS | `GADMediationAdapterMoloco` |

Also exported from JS:

```ts
import {
  nativeAdapterClassName,
  networkSlug,
} from '@react-native-google-mobile-ads/moloco';
```

## Mediation dependencies (pinned in this package)

| Platform | Coordinate | Version pin |
| -------- | ---------- | ----------- |
| Android | `com.google.ads.mediation:moloco` | `4.12.0.0` |
| iOS | CocoaPods `GoogleMobileAdsMediationMoloco` | `4.10.0.0` |

Citations (verify at upgrade time):

- Android (GAM): https://developers.google.com/ad-manager/mobile-ads-sdk/android/mediation/moloco
- iOS (GAM): https://developers.google.com/ad-manager/mobile-ads-sdk/ios/mediation/moloco
- Google Maven: `com.google.ads.mediation:moloco` (`latest` / `release` = `4.12.0.0`)
- CocoaPods: https://cocoapods.org/pods/GoogleMobileAdsMediationMoloco

Core continues to own `play-services-ads` / `Google-Mobile-Ads-SDK`. This package does not re-pin the GMA SDK.

iOS platform floor is **13.0** (Moloco mediation guide prerequisites / CocoaPods podspec). Android minSdk is **23** (guide prerequisites).

## Expo (optional)

```js
// app.json / app.config.js plugins
[
  '@react-native-google-mobile-ads/moloco',
  {
    // Pass Moloco SKAdNetwork IDs from Moloco’s current docs
    skAdNetworkItems: [/* ... */],
  },
]
```

App IDs stay in the core Expo plugin.

## Out of scope

- AppLovin MAX host SDK
- CloudX / other non-GAM hosts
- Fyber/DT Exchange (no Google GAM adapter — do not invent)
