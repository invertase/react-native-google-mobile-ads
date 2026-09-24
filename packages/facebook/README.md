# `@react-native-google-mobile-ads/facebook`

Meta Audience Network (Facebook) **Google Ad Manager / AdMob mediation** adapter package for [`react-native-google-mobile-ads`](https://github.com/invertase/react-native-google-mobile-ads).

This package links Google’s official Meta Audience Network mediation adapter on Android and iOS. It does **not** ship AppLovin MAX, CloudX, or JS ad-format APIs — use core `initialize()` / adapter status for discovery. It **does** expose Meta privacy hooks that must run before GMA initialize.

## Install

```bash
yarn add @react-native-google-mobile-ads/facebook
# peer: react-native-google-mobile-ads
```

Autolinking pulls in the native mediation artifacts. Rebuild the app after install.

## Advertiser tracking (call before `initialize`)

On **iOS versions below 17**, Meta’s Audience Network expects advertiser tracking to be set **before**
Google Mobile Ads initialize. After App Tracking Transparency resolves (when you use it), call:

```ts
import mobileAds from 'react-native-google-mobile-ads';
import { setAdvertiserTrackingEnabled } from '@react-native-google-mobile-ads/facebook';

// After ATT (e.g. expo-tracking-transparency) resolves:
setAdvertiserTrackingEnabled(true); // or false when tracking is denied
await mobileAds().initialize();
```

| Platform | Behavior |
| -------- | -------- |
| iOS | Calls `FBAdSettings.setAdvertiserTrackingEnabled`. On **iOS 17+** with Audience Network **6.15.0+**, Meta marks this setter deprecated and unused — the SDK uses `ATTrackingManager.trackingAuthorizationStatus` instead (verified from local `FBAdSettings.h` in FBAudienceNetwork 6.17.1 / 6.22.0). |
| Android | No-op — Meta’s Android `AdSettings` (audience-network-sdk 6.22.0) has no advertiser-tracking setter |

Optional Limited Data Use / data-processing options:

```ts
import { setDataProcessingOptions } from '@react-native-google-mobile-ads/facebook';

setDataProcessingOptions(['LDU']);
// or with geography:
setDataProcessingOptions(['LDU'], /* country */ 1, /* state */ 1000);
```

| Platform | Behavior |
| -------- | -------- |
| Android | `AdSettings.setDataProcessingOptions` |
| iOS | `FBAdSettings.setDataProcessingOptions` |

These are **runtime JS APIs**, not Expo plugin keys. Passing `metaAdvertiserTrackingEnabled` (or similar) to the core or facebook Expo plugin is ignored with a warning.

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

Platform floors align with core: iOS **15.1** and Android minSdk **24**. The Meta Audience Network mediation adapter `6.22.0.0` requires iOS 15.0, below the React Native-driven product floor.

> Google’s mediation guide permits Android minSdk 23 upstream; this product advertises 24 to match core.

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

App IDs stay in the core Expo plugin. Advertiser tracking stays in JS (`setAdvertiserTrackingEnabled`) — ATT status is not knowable at prebuild time.

## iOS launch abort when this adapter is linked

`GoogleMobileAdsMediationFacebook` embeds Meta’s `FBAudienceNetwork`. That framework can `SIGABRT` during
its own early main-queue `dispatch_once` work — **before any ad request and before JS**. One reported
exception reason is an unrecognized selector involving format string `%s` on `NSString`.

That is **not** a bug in this package’s `RNGoogleMobileAdsAdapterFacebook` bridge (those methods only run
when JS calls them). This package’s `setAdvertiserTrackingEnabled` / `setDataProcessingOptions` helpers
therefore cannot prevent a process-start abort inside Meta’s binary.

Checklist when only Meta mediation crashes at launch (AppLovin / Unity OK):

1. AdMob / GAM `GADApplicationIdentifier` via the **core** Expo plugin (missing AdMob App ID is a separate start crash).
2. `NSUserTrackingUsageDescription` when using ATT (`userTrackingUsageDescription` on the core plugin).
3. Use this package’s pin (`6.22.0.0`) instead of an older `expo-build-properties` Facebook mediation pod.
4. Retest on a shipping iOS release (not a beta), then escalate to Meta / Google’s Meta adapter with the crash report if it still aborts.

## Out of scope

- AppLovin MAX host SDK
- CloudX / other non-GAM hosts
- Fyber/DT Exchange (no Google GAM adapter — do not invent)
- Invented Expo keys such as `metaAudienceNetworkEnabled` (enablement is “adapter installed + AdMob UI”)
