<p align="center">
  <a href="https://docs.page/invertase/react-native-google-mobile-ads">
    <img width="160px" src="https://raw.githubusercontent.com/invertase/react-native-google-mobile-ads/main/docs/img/logo_admob_192px.svg"><br/>
  </a>
  <h2 align="center">React Native Google Mobile Ads</h2>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/react-native-google-mobile-ads"><img src="https://img.shields.io/npm/dm/react-native-google-mobile-ads.svg?style=flat-square" alt="NPM downloads"></a>
  <a href="https://www.npmjs.com/package/react-native-google-mobile-ads"><img src="https://img.shields.io/npm/v/react-native-google-mobile-ads.svg?style=flat-square" alt="NPM version"></a>
  <a href="https://github.com/invertase/react-native-google-mobile-ads/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/react-native-google-mobile-ads.svg?style=flat-square" alt="License"></a>
</p>

<p align="center">
  <a href="https://invertase.link/discord"><img src="https://img.shields.io/discord/295953187817521152.svg?style=flat-square&colorA=7289da&label=Chat%20on%20Discord" alt="Chat on Discord"></a>
  <a href="https://twitter.com/invertaseio"><img src="https://img.shields.io/twitter/follow/invertaseio.svg?style=flat-square&colorA=1da1f2&colorB=&label=Follow%20on%20Twitter" alt="Follow on Twitter"></a>
  <a href="https://www.facebook.com/groups/invertase.io"><img src="https://img.shields.io/badge/Follow%20on%20Facebook-4172B8?logo=facebook&style=flat-square&logoColor=fff" alt="Follow on Facebook"></a>
</p>

---

**React Native Google Mobile Ads** lets you monetize your app with Google AdMob or Google Ad Manager. It wraps the native Google Mobile Ads SDKs for iOS and Android.

- **Expo first**: install with `npx expo install` and configure through the bundled config plugin. Bare React Native CLI apps are fully supported.
- **Every format**: app open, banner, native, interstitial, rewarded and rewarded interstitial, plus Ad Manager, consent (UMP) and mediation.
- **React-friendly**: imperative ad classes, React hooks, and preload pools for apps that show many ads.
- **Typed and tested**: written in TypeScript with a generated [API reference](https://invertase.github.io/react-native-google-mobile-ads/), and unit and end-to-end tested on both platforms.

## Quick start (Expo)

```bash
npx expo install react-native-google-mobile-ads expo-dev-client
```

Add your AdMob App IDs to the config plugin in `app.json`, then create a [development build](https://docs.expo.dev/develop/development-builds/introduction/) (the module does not run in Expo Go):

```json
{
  "expo": {
    "plugins": [
      [
        "react-native-google-mobile-ads",
        {
          "androidAppId": "ca-app-pub-xxxxxxxx~xxxxxxxx",
          "iosAppId": "ca-app-pub-xxxxxxxx~xxxxxxxx"
        }
      ]
    ]
  }
}
```

Next: gather consent, initialize the SDK and show your first ad by following [Getting Started](https://docs.page/invertase/react-native-google-mobile-ads). Bare React Native CLI projects start at [Installation — React Native CLI](https://docs.page/invertase/react-native-google-mobile-ads/installation/react-native).

## Ad formats

### App open

App open ads are a special ad format intended for publishers wishing to monetize their app load screens.

<img width="200" src="https://developers.google.com/static/admob/images/app-open-ad.png" alt="App open ad">

[Learn More](https://docs.page/invertase/react-native-google-mobile-ads/ad-formats/app-open)

### Banner

Banner ad units display rectangular ads that occupy a portion of an app's layout.
They stay on screen while users are interacting with the app, either anchored at the top or bottom of the screen or inline with content as the user scrolls.
Banner ads can refresh automatically after a certain period of time.

#### Anchored adaptive

A dynamically sized banner that is full-width and auto-height. Anchored adaptive banners are expected to be always on-screen, locked to the screen’s top or bottom.

<img width="200" src="https://developers.google.com/static/admob/images/Android_adaptive.png" alt="Anchored adaptive">

[Learn More](https://docs.page/invertase/react-native-google-mobile-ads/ad-formats/banner#anchored-and-inline-adaptive-banners)

#### Inline adaptive

Inline adaptive banners are larger, taller banners compared to anchored adaptive banners.
They are of variable height, and can be as tall as the device screen.
They are intended to be placed in scrolling content.

<img width="600" src="https://developers.google.com/static/admob/images/inline-adaptive.png" alt="Inline adaptive">

[Learn More](https://docs.page/invertase/react-native-google-mobile-ads/ad-formats/banner#anchored-and-inline-adaptive-banners)

#### Collapsible

Collapsible banner ads are intended to improve performance of anchored ads that are otherwise a smaller size.

<img width="400" src="https://developers.google.com/static/admob/images/collapsible-banner.png" alt="Collapsible banner">

[Learn More](https://docs.page/invertase/react-native-google-mobile-ads/ad-formats/banner#collapsible-banner-ads)

#### Fixed size (legacy)

The Google Mobile Ads SDK supports fixed ad sizes for situations where adaptive banners ads don't meet your needs.
Banner (320x50), Large banner (320x100), Medium rectangle (300x250), full banner (468x60) and leaderboard (728x90).

[Learn More](https://docs.page/invertase/react-native-google-mobile-ads/ad-formats/banner#banner-size-catalog)

### Native

Native ads allow you to customize the look and feel of the ads that appear in your app.
You decide how and where they're placed, so the layout is more consistent with your app's design.

<img width="300" src="https://developers.google.com/static/admob/images/format-native.svg" alt="Native">

[Learn More](https://docs.page/invertase/react-native-google-mobile-ads/ad-formats/native)

### Interstitial

Interstitial ad units show full-page ads in your app. Place them at natural breaks & transitions in your app's interface, such as after level completion in a gaming app.

<img width="300" src="https://developers.google.com/static/admob/images/format-interstitial.svg" alt="Interstitial">

[Learn More](https://docs.page/invertase/react-native-google-mobile-ads/ad-formats/interstitial)

### Rewarded

AdMob rewarded ad units allow you to reward users with in-app items for interacting with video ads, playable ads, and surveys.

<img width="300" src="https://developers.google.com/static/admob/images/format-rewarded.svg" alt="Rewarded">

[Learn More](https://docs.page/invertase/react-native-google-mobile-ads/ad-formats/rewarded)

### Rewarded Interstitial

Rewarded interstitial is a type of incentivized ad format that allows you to offer rewards for ads that appear automatically during natural app transitions.
Unlike rewarded ads, users don't opt in to view a rewarded interstitial, but Google requires an intro screen with clear reward messaging and an option to skip before the ad shows.

<img width="300" src="https://developers.google.com/static/admob/images/format-rewarded-interstitial.svg" alt="Rewarded interstitial">

[Learn More](https://docs.page/invertase/react-native-google-mobile-ads/ad-formats/rewarded-interstitial)

## Platform requirements

Version 17 requires React Native 0.86.0 or newer with
[the New Architecture](https://reactnative.dev/docs/the-new-architecture/landing-page)
enabled. The Legacy Architecture is no longer supported. Expo projects need a development
build (Expo Go is not supported). The minimum operating system versions are **iOS 15.1** and
**Android API level 24**. See [Prerequisites](https://docs.page/invertase/react-native-google-mobile-ads/prerequisites)
for the full list.

On Android you can choose the classic Google Mobile Ads SDK (default) or the
[GMA Next-Gen SDK](https://developers.google.com/admob/android/next-gen/quick-start) at build
time; the JavaScript API is the same either way. See
[Android SDK backend](https://docs.page/invertase/react-native-google-mobile-ads/config-plugin#android-sdk-backend).

### Native implementation status

Every surface below works on the New Architecture. Surfaces marked To-Do still run through
React Native's interoperability layer and have not yet been ported to a native Turbo Module or
Fabric component; the port does not change the JavaScript API.

| Platform | Feature                                                                                                                                                        | Status                                                        |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| iOS      | Mobile Ads SDK Methods (Turbo Native Module)                                                                                                                   | ✅ Complete                                                   |
| iOS      | Banners (Fabric Native Component)                                                                                                                              | ✅ Complete                                                   |
| iOS      | Full Screen Ads (Turbo Native Module)                                                                                                                          | ✅ Complete                                                   |
| iOS      | Native Ads (Turbo Native Module, Fabric Native Component)                                                                                                      | ✅ Complete                                                   |
| iOS      | User Messaging Platform (Turbo Native Module)                                                                                                                  | ✅ Complete                                                   |
| iOS      | [EventEmitter](https://github.com/reactwg/react-native-new-architecture/blob/main/docs/turbo-modules.md#add-event-emitting-capabilities) (Turbo Native Module) | ⏳ To-Do                                                      |
| Android  | Mobile Ads SDK Methods (Turbo Native Module)                                                                                                                   | ⏳ To-Do                                                      |
| Android  | Banners (Fabric Native Component)                                                                                                                              | 🟡 Partial: multi-format banner ported, standard banner To-Do |
| Android  | Full Screen Ads (Turbo Native Module)                                                                                                                          | ⏳ To-Do                                                      |
| Android  | Native Ads (Turbo Native Module, Fabric Native Component)                                                                                                      | ✅ Complete                                                   |
| Android  | User Messaging Platform (Turbo Native Module)                                                                                                                  | ⏳ To-Do                                                      |
| Android  | [EventEmitter](https://github.com/reactwg/react-native-new-architecture/blob/main/docs/turbo-modules.md#add-event-emitting-capabilities) (Turbo Native Module) | ⏳ To-Do                                                      |

## Documentation

- [Getting Started](https://docs.page/invertase/react-native-google-mobile-ads): the integration path from install to first ad
- Installation: [Expo (recommended)](https://docs.page/invertase/react-native-google-mobile-ads/installation/expo) or [React Native CLI](https://docs.page/invertase/react-native-google-mobile-ads/installation/react-native)
- [Ad formats](https://docs.page/invertase/react-native-google-mobile-ads/ad-formats), including [React hooks](https://docs.page/invertase/react-native-google-mobile-ads/ad-formats/hooks) and [Google Ad Manager](https://docs.page/invertase/react-native-google-mobile-ads/ad-formats/ad-manager)
- [Consent & privacy](https://docs.page/invertase/react-native-google-mobile-ads/consent-basics)
- [Testing](https://docs.page/invertase/react-native-google-mobile-ads/testing) and [Common reasons ads do not show](https://docs.page/invertase/react-native-google-mobile-ads/common-reasons-for-ads-not-showing)
- [Using with React Native Firebase](https://docs.page/invertase/react-native-google-mobile-ads/firebase)
- [Migrating to v17](https://docs.page/invertase/react-native-google-mobile-ads/migrating-to-v17)
- [API reference](https://invertase.github.io/react-native-google-mobile-ads/)

### For AI coding agents

This package ships an integrator guide for coding agents at
[`AGENTS.md`](https://github.com/invertase/react-native-google-mobile-ads/blob/main/packages/core/AGENTS.md)
(also installed at `node_modules/react-native-google-mobile-ads/AGENTS.md`). Point your agent at it
before it writes ad code. See [For AI agents](https://docs.page/invertase/react-native-google-mobile-ads/ai-agents).

## Contributing

- [Issues](https://github.com/invertase/react-native-google-mobile-ads/issues)
- [PRs](https://github.com/invertase/react-native-google-mobile-ads/pulls)
- [Guidelines](https://github.com/invertase/react-native-google-mobile-ads/blob/main/CONTRIBUTING.md)
- [Code of Conduct](https://github.com/invertase/.github/blob/main/CODE_OF_CONDUCT.md)

## License

- See [LICENSE](https://github.com/invertase/react-native-google-mobile-ads/blob/main/LICENSE)

---

<p align="center">
  <a href="https://invertase.io/?utm_source=readme&utm_medium=footer&utm_campaign=react-native-google-mobile-ads">
    <img width="75px" src="https://static.invertase.io/assets/invertase/invertase-rounded-avatar.png">
  </a>
  <p align="center">
    Built and maintained by <a href="https://invertase.io/?utm_source=readme&utm_medium=footer&utm_campaign=react-native-google-mobile-ads">Invertase</a>.
  </p>
</p>
