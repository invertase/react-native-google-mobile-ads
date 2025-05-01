<p align="center">
  <a href="https://docs.page/invertase/react-native-google-mobile-ads">
    <img width="160px" src="./docs/img/logo_admob_192px.svg"><br/>
  </a>
  <h2 align="center">React Native Google Mobile Ads</h2>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/react-native-google-mobile-ads"><img src="https://img.shields.io/npm/dm/react-native-google-mobile-ads.svg?style=flat-square" alt="NPM downloads"></a>
  <a href="https://www.npmjs.com/package/react-native-google-mobile-ads"><img src="https://img.shields.io/npm/v/react-native-google-mobile-ads.svg?style=flat-square" alt="NPM version"></a>
  <a href="/LICENSE"><img src="https://img.shields.io/npm/l/react-native-google-mobile-ads.svg?style=flat-square" alt="License"></a>
</p>

<p align="center">
  <a href="https://invertase.link/discord"><img src="https://img.shields.io/discord/295953187817521152.svg?style=flat-square&colorA=7289da&label=Chat%20on%20Discord" alt="Chat on Discord"></a>
  <a href="https://twitter.com/invertaseio"><img src="https://img.shields.io/twitter/follow/invertaseio.svg?style=flat-square&colorA=1da1f2&colorB=&label=Follow%20on%20Twitter" alt="Follow on Twitter"></a>
  <a href="https://www.facebook.com/groups/invertase.io"><img src="https://img.shields.io/badge/Follow%20on%20Facebook-4172B8?logo=facebook&style=flat-square&logoColor=fff" alt="Follow on Facebook"></a>
</p>

---

**React Native Google Mobile Ads** allows you to monetize your app with AdMob; a React Native wrapper around the native Google-Mobile-Ads SDKs for both iOS and Android.

React Native Google Mobile Ads is built with three key principals in mind;

- 🧪 **Well tested**
  - the module is extensively tested to >95% coverage (getting there after moving from react-native-firebase!)
- 👁 **Well typed**
  - first class support for Typescript included
- 📄 **Well documented**
  - full reference & installation documentation alongside detailed guides and FAQs

## Ad formats

### App open

App open ads are a special ad format intended for publishers wishing to monetize their app load screens.

<img width="200" src="https://developers.google.com/static/admob/images/app-open-ad.png" alt="App open ad">

[Learn More](https://docs.page/invertase/react-native-google-mobile-ads/displaying-ads#app-open-ads)

### Banner

Banner ad units display rectangular ads that occupy a portion of an app's layout.
They stay on screen while users are interacting with the app, either anchored at the top or bottom of the screen or inline with content as the user scrolls.
Banner ads can refresh automatically after a certain period of time.

#### Anchored adaptive

A dynamically sized banner that is full-width and auto-height. Anchored adaptive banners are expected to be always on-screen, locked to the screen’s top or bottom.

<img width="200" src="https://developers.google.com/static/admob/images/Android_adaptive.png" alt="Anchored adaptive">

[Learn More](https://docs.page/invertase/react-native-google-mobile-ads/displaying-ads#banner-ads-component)

#### Inline adaptive

Inline adaptive banners are larger, taller banners compared to anchored adaptive banners.
They are of variable height, and can be as tall as the device screen.
They are intended to be placed in scrolling content.

<img width="600" src="https://developers.google.com/static/admob/images/inline-adaptive.png" alt="Inline adaptive">

[Learn More](https://docs.page/invertase/react-native-google-mobile-ads/displaying-ads#banner-ads-component)

#### Collapsible

Collapsible banner ads are intended to improve performance of anchored ads that are otherwise a smaller size.

<img width="400" src="https://developers.google.com/static/admob/images/collapsible-banner.png" alt="Collapsible banner">

[Learn More](https://docs.page/invertase/react-native-google-mobile-ads/displaying-ads#collapsible-banner-ads)

#### Fixed size (legacy)

The Google Mobile Ads SDK supports fixed ad sizes for situations where adaptive banners ads don't meet your needs.
Banner (320x50), Large banner (320x100), Medium rectangle (300x250), full banner (468x60) and leaderboard (728x90).

[Learn More](https://docs.page/invertase/react-native-google-mobile-ads/displaying-ads#banner-ads-component)

### Native

Native ads allow you to customize the look and feel of the ads that appear in your app.
You decide how and where they're placed, so the layout is more consistent your app's design.

<img width="300" src="https://developers.google.com/static/admob/images/format-native.svg" alt="Native">

[Learn More](https://docs.page/invertase/react-native-google-mobile-ads/native-ads)

### Interstitial

Interstitial ad units show full-page ads in your app. Place them at natural breaks & transitions in your app's interface, such as after level completion in a gaming app.

<img width="300" src="https://developers.google.com/static/admob/images/format-interstitial.svg" alt="Interstitial">

[Learn More](https://docs.page/invertase/react-native-google-mobile-ads/displaying-ads#interstitial-ads)

### Rewarded

AdMob rewarded ad units allow you to reward users with in-app items for interacting with video ads, playable ads, and surveys.

<img width="300" src="https://developers.google.com/static/admob/images/format-rewarded.svg" alt="Rewarded">

[Learn More](https://docs.page/invertase/react-native-google-mobile-ads/displaying-ads#rewarded-ads)

### Rewarded Interstitial

Rewarded interstitial is a type of incentivized ad format that allows you offer rewards for ads that appear automatically during natural app transitions.
Unlike rewarded ads, users aren't required to opt-in to view a rewarded interstitial.

<img width="300" src="https://developers.google.com/static/admob/images/format-rewarded-interstitial.svg" alt="Rewarded interstitial">

[Learn More](https://docs.page/invertase/react-native-google-mobile-ads/displaying-ads#rewarded-interstitial-ads)

## Migrating to the New Architecture Status (backwards compatible)

This package can be used in both The Old and [The New Architecture](https://reactnative.dev/docs/the-new-architecture/landing-page).
When using The New Architecture, some legacy code will still be used though. See status below:

| Platform | Feature                                                                                                                                                        | Status      |
| -------- |----------------------------------------------------------------------------------------------------------------------------------------------------------------| ----------- |
| iOS      | Mobile Ads SDK Methods (Turbo Native Module)                                                                                                                   | ✅ Complete |
| iOS      | Banners (Fabric Native Component)                                                                                                                              | ✅ Complete |
| iOS      | Full Screen Ads (Turbo Native Module)                                                                                                                          | ✅ Complete |
| iOS      | Native Ads (Turbo Native Module, Fabric Native Component)                                                                                                      | ✅ Complete |
| iOS      | User Messaging Platform (Turbo Native Module)                                                                                                                  | ✅ Complete |
| iOS      | [EventEmitter](https://github.com/reactwg/react-native-new-architecture/blob/main/docs/turbo-modules.md#add-event-emitting-capabilities) (Turbo Native Module) | ⏳ To-Do    |
| iOS      | Revenue Precision Constants (Turbo Native Module)                                                                                                              | ✅ Complete |
| Android  | Mobile Ads SDK Methods (Turbo Native Module)                                                                                                                   | ⏳ To-Do    |
| Android  | Banners (Fabric Native Component)                                                                                                                              | ⏳ To-Do    |
| Android  | Full Screen Ads (Turbo Native Module)                                                                                                                          | ⏳ To-Do    |
| Android  | Native Ads (Turbo Native Module, Fabric Native Component)                                                                                                      | ✅ Complete |
| Android  | User Messaging Platform (Turbo Native Module)                                                                                                                  | ⏳ To-Do    |
| Android  | [EventEmitter](https://github.com/reactwg/react-native-new-architecture/blob/main/docs/turbo-modules.md#add-event-emitting-capabilities) (Turbo Native Module) | ⏳ To-Do    |
| Android  | Revenue Precision Constants (Turbo Native Module)                                                                                                              | ⏳ To-Do    |

## Documentation

- [Installation](https://docs.page/invertase/react-native-google-mobile-ads)
- [Displaying Ads](https://docs.page/invertase/react-native-google-mobile-ads/displaying-ads)

## Contributing

- [Issues](https://github.com/invertase/react-native-google-mobile-ads/issues)
- [PRs](https://github.com/invertase/react-native-google-mobile-ads/pulls)
- [Guidelines](https://github.com/invertase/react-native-google-mobile-ads/blob/main/CONTRIBUTING.md)
- [Code of Conduct](https://github.com/invertase/meta/blob/main/CODE_OF_CONDUCT.md)

## License

- See [LICENSE](/LICENSE)

---

<p align="center">
  <a href="https://invertase.io/?utm_source=readme&utm_medium=footer&utm_campaign=react-native-google-mobile-ads">
    <img width="75px" src="https://static.invertase.io/assets/invertase/invertase-rounded-avatar.png">
  </a>
  <p align="center">
    Built and maintained by <a href="https://invertase.io/?utm_source=readme&utm_medium=footer&utm_campaign=react-native-google-mobile-ads">Invertase</a>.
  </p>
</p>
