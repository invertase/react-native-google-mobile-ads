# `@react-native-google-mobile-ads/applovin`

AppLovin **Google Ad Manager / AdMob mediation** adapter package for [`react-native-google-mobile-ads`](https://github.com/invertase/react-native-google-mobile-ads).

This package links Google’s official AppLovin mediation adapter on Android and iOS. It does **not** ship AppLovin MAX, CloudX, or any JS ad APIs — use core `initialize()` / adapter status for discovery.

## Install

```bash
yarn add @react-native-google-mobile-ads/applovin
# peer: react-native-google-mobile-ads
```

Autolinking pulls in the native mediation artifacts. Rebuild the app after install.

## Native adapter class names (GAM / AdMob UI)

| Platform | Class name |
| -------- | ---------- |
| Android | `com.google.ads.mediation.applovin.AppLovinMediationAdapter` |
| iOS | `GADMediationAdapterAppLovin` |

Also exported from JS:

```ts
import {
  nativeAdapterClassName,
  networkSlug,
} from '@react-native-google-mobile-ads/applovin';
```

## Mediation dependencies (pinned in this package)

| Platform | Coordinate | Version pin |
| -------- | ---------- | ----------- |
| Android | `com.google.ads.mediation:applovin` | `13.6.4.1` |
| iOS | CocoaPods `GoogleMobileAdsMediationAppLovin` | `13.6.4.0` |

Citations (verify at upgrade time):

- Android: https://developers.google.com/admob/android/mediation/applovin
- iOS: https://developers.google.com/admob/ios/mediation/applovin
- CocoaPods: https://cocoapods.org/pods/GoogleMobileAdsMediationAppLovin

Core continues to own `play-services-ads` / `Google-Mobile-Ads-SDK`. This package does not re-pin the GMA SDK.

## Expo (optional)

```js
// app.json / app.config.js plugins
[
  '@react-native-google-mobile-ads/applovin',
  {
    // Pass AppLovin SKAdNetwork IDs from AppLovin’s current docs
    skAdNetworkItems: [/* ... */],
  },
]
```

App IDs stay in the core Expo plugin.

## Out of scope

- AppLovin MAX host SDK
- CloudX / other non-GAM hosts
- Fyber/DT Exchange (no Google GAM adapter — do not invent)
