# `@react-native-google-mobile-ads/facebook`

Meta Audience Network (Facebook) **Google Ad Manager / AdMob mediation** adapter package for [`react-native-google-mobile-ads`](https://github.com/invertase/react-native-google-mobile-ads).

This package links Google’s official Meta Audience Network mediation adapter on Android and iOS. It does **not** ship AppLovin MAX, CloudX, or any JS ad APIs — use core `initialize()` / adapter status for discovery.

## Install

```bash
yarn add @react-native-google-mobile-ads/facebook
# peer: react-native-google-mobile-ads
```

Autolinking pulls in the native mediation artifacts. Rebuild the app after install.

## Native adapter class names (GAM / AdMob UI)

| Platform | Class name |
| -------- | ---------- |
| Android | `com.google.ads.mediation.facebook.FacebookMediationAdapter` |
| iOS | `GADMediationAdapterFacebook` |

Also exported from JS:

```ts
import {
  nativeAdapterClassName,
  networkSlug,
} from '@react-native-google-mobile-ads/facebook';
```

## Mediation dependencies (pinned in this package)

| Platform | Coordinate | Version pin |
| -------- | ---------- | ----------- |
| Android | `com.google.ads.mediation:facebook` | `6.22.0.0` |
| iOS | CocoaPods `GoogleMobileAdsMediationFacebook` | `6.22.0.0` |

Citations (verify at upgrade time):

- Android: https://developers.google.com/admob/android/mediation/meta
- iOS: https://developers.google.com/admob/ios/mediation/meta
- CocoaPods: https://cocoapods.org/pods/GoogleMobileAdsMediationFacebook

Core continues to own `play-services-ads` / `Google-Mobile-Ads-SDK`. This package does not re-pin the GMA SDK.

iOS platform floor is **15.0** (required by Meta Audience Network mediation adapter `6.22.0.0`).

## Expo (optional)

```js
// app.json / app.config.js plugins
[
  '@react-native-google-mobile-ads/facebook',
  {
    // Pass Meta Audience Network SKAdNetwork IDs from Meta’s current docs
    skAdNetworkItems: [/* ... */],
  },
]
```

App IDs stay in the core Expo plugin.

## Out of scope

- AppLovin MAX host SDK
- CloudX / other non-GAM hosts
- Fyber/DT Exchange (no Google GAM adapter — do not invent)
