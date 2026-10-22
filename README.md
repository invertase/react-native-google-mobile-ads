<p align="center">
  <a href="https://docs.page/invertase/react-native-google-mobile-ads">
    <img width="160px" src="https://raw.githubusercontent.com/invertase/react-native-google-mobile-ads/main/docs/img/logo_admob_192px.svg"><br/>
  </a>
  <h1 align="center">React Native Google Mobile Ads</h1>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/react-native-google-mobile-ads"><img src="https://img.shields.io/npm/dm/react-native-google-mobile-ads" alt="npm downloads" /> <img src="https://img.shields.io/npm/v/react-native-google-mobile-ads" alt="npm version" /></a>
  <img src="https://img.shields.io/badge/docs-docs.page-E69135" alt="docs.page" />
  <img src="https://img.shields.io/badge/New%20Architecture-required-2D303A" alt="New Architecture required" />
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-blue" alt="Apache-2.0" /></a>
</p>

<p align="center">
  <a href="https://docs.page/invertase/react-native-google-mobile-ads">Docs</a>
  ·
  <a href="./CONTRIBUTING.md">Contribute</a>
</p>

**React Native Google Mobile Ads** lets you monetize your app with Google AdMob or Google Ad Manager. It wraps the native Google Mobile Ads SDKs for iOS and Android.

> [!IMPORTANT]
> Use React Native 0.86 or newer with the New Architecture turned on. If the New Architecture is off, the native install fails. A missing app ID crashes startup or fails the build. The package has native code, so Expo Go cannot run it. Check out [Prerequisites](https://docs.page/invertase/react-native-google-mobile-ads/prerequisites) for more information.

## Install

**Prompt your agent:**

```text
Read https://docs.page/invertase/react-native-google-mobile-ads/prerequisites.md, then https://docs.page/invertase/react-native-google-mobile-ads/installation/expo.md (use …/installation/react-native.md for bare RN CLI), then https://docs.page/invertase/react-native-google-mobile-ads/consent-basics.md, https://docs.page/invertase/react-native-google-mobile-ads/initialization.md, and https://docs.page/invertase/react-native-google-mobile-ads/first-ad.md. After install, read node_modules/react-native-google-mobile-ads/AGENTS.md. React Native 0.86 or newer. New Architecture required. Consent before initialize. Test ad units until the integration is verified.
```

**Or set it up yourself with Expo:**

1. Install the package. This also installs the development client.

   ```bash
   npx expo install react-native-google-mobile-ads expo-dev-client
   ```

2. Add your AdMob app IDs to the config plugin in `app.json`, then create a [development build](https://docs.expo.dev/develop/development-builds/introduction/). The module does not run in Expo Go.

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

3. Gather consent, initialize the SDK, and show your first ad. [Getting Started](https://docs.page/invertase/react-native-google-mobile-ads) is that path.

Bare React Native CLI projects start at [Install with React Native CLI](https://docs.page/invertase/react-native-google-mobile-ads/installation/react-native).

## Consent and test ads

Before you initialize, gather consent. The [Consent and privacy](https://docs.page/invertase/react-native-google-mobile-ads/consent-basics) page and the [Initialize the software development kit](https://docs.page/invertase/react-native-google-mobile-ads/initialization) page describe that order.

Until you verify the integration, use test ad units. The [Test ads](https://docs.page/invertase/react-native-google-mobile-ads/first-ad) page shows a test unit for one format.

## More information

- [Ad formats](https://docs.page/invertase/react-native-google-mobile-ads/ad-formats) to understand each format.
- [Migrating to v17](https://docs.page/invertase/react-native-google-mobile-ads/migrating-to-v17) to upgrade from an older release.
- [Reference API](https://invertase.github.io/react-native-google-mobile-ads/) to read the generated reference.

## Contributing

- [Discord](https://invertase.link/discord)
- [GitHub Issues](https://github.com/invertase/react-native-google-mobile-ads/issues)
- [Pull requests](https://github.com/invertase/react-native-google-mobile-ads/pulls)
- [Code of Conduct](https://github.com/invertase/.github/blob/main/CODE_OF_CONDUCT.md)

## License

Apache-2.0. The terms are in the `LICENSE` file.

---

<p align="center">
  <a href="https://invertase.io/?utm_source=readme&utm_medium=footer&utm_campaign=react-native-google-mobile-ads">
    <img src="https://static.invertase.io/assets/invertase/invertase-rounded-avatar.png" alt="Invertase" width="48" height="48" />
    <br />
    Invertase builds and maintains this library.
  </a>
</p>
