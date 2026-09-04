# GAM adapter package template

**Private scaffold** (`@invertase/rngma-gam-adapter-template`). Character network packages copy from here; this directory is **not** a publishable `@react-native-google-mobile-ads/<network>` package.

Scope:

- Scoped package layout + bob/exports
- Android Gradle hook for `com.google.ads.mediation:<network>`
- CocoaPods hook for `GoogleMobileAdsMediation*`
- Optional Expo plugin slice (SKAdNetwork merge only — app IDs stay in core)
- Public JS surface: `nativeAdapterClassName` + `networkSlug` only (no ad APIs)

Out of scope: MAX / CloudX / Yandex-as-host packages; filling AppLovin/Meta/… product SDK pins (add one network package per commit); core public JS API changes.

## Layout

```text
packages/_template/
  package.json                 # private; gamAdapter + sdkVersions placeholders
  src/index.ts                 # nativeAdapterClassName / networkSlug
  android/build.gradle         # api mediation artifact from package.json
  android/src/main/...         # empty manifest + package marker
  ios/*.m                      # pod source marker
  RNGoogleMobileAdsAdapter.podspec
  app.plugin.js + plugin/      # optional Expo SKAdNetwork merge
  react-native.config.js       # autolinking (no TurboModule)
  __tests__/                   # template surface unit tests
  README.md                    # this file
```

## Instantiating a network package

1. Copy this tree to `packages/<network>/` (or fill an existing empty network shell under `packages/`).
2. Set `private` → omit / `false`, rename package to `@react-native-google-mobile-ads/<network>`.
3. Replace every `__PLACEHOLDER__` token:

| Token | Example (AppLovin GAM adapter — verify at ship time) |
| ----- | ---------------------------------------------------- |
| `__NETWORK__` | `applovin` |
| `__ANDROID_ARTIFACT__` | `applovin` → artifact `com.google.ads.mediation:applovin` |
| `__ANDROID_MEDIATION_VERSION__` | vendor pin from Google mediation release notes |
| `__ANDROID_ADAPTER_CLASS__` | `com.google.ads.mediation.applovin.AppLovinMediationAdapter` |
| `__IOS_MEDIATION_POD__` | `GoogleMobileAdsMediationAppLovin` |
| `__IOS_MEDIATION_VERSION__` | vendor pin |
| `__IOS_ADAPTER_CLASS__` | `GADMediationAdapterAppLovin` |

4. Rename podspec / `s.name` / Android `namespace` / Java package / Expo plugin export to the network.
5. Update `repository.directory`, keywords, README (Gradle/pod FQCN for GAM UI paste).
6. Do **not** add MAX host, CloudX host, or Yandex-as-host SDKs.
7. Peer-depend on `react-native-google-mobile-ads` only; never import core internals.

Empty shells under `packages/{applovin,facebook,…}/` stay metadata-only until each network is filled in its own commit.

## Build

```bash
yarn workspace @invertase/rngma-gam-adapter-template prepare
```

Root `yarn prepare` (Lerna) also builds this private package when present.
