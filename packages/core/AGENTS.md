# React Native Google Mobile Ads — integrator agents

You are helping a developer **integrate** `react-native-google-mobile-ads` into an app.
This file ships inside the npm package (`node_modules/react-native-google-mobile-ads/AGENTS.md`).

**Canonical docs (prefer these over inventing APIs):**
[https://docs.page/invertase/react-native-google-mobile-ads](https://docs.page/invertase/react-native-google-mobile-ads)
· [For AI agents](https://docs.page/invertase/react-native-google-mobile-ads/ai-agents)
(append `.md` to any docs.page URL for plain Markdown).

**Not for you:** the `AGENTS.md` at the GitHub repository root is maintainer/contributor steering for this library’s development. Do not follow it when integrating into an app.

Use `mobileAds()` (not a capital-`MobileAds()` constructor). Prefer the v17 **options-form** fullscreen hooks over deprecated positional hooks.

---

## v17: which API to use

- **Simple create → load → show, or `<BannerAd>` / `NativeAd`:** Classic APIs (no pool, no provider)
- **Imperative fullscreen `ad.show()`:** Not loaded, already showing, or a platform decline reject the promise — `.catch(...)` it; a destroyed ad, or invalid `showOptions` on a loaded ad, throw synchronously (programmer error — fix the call site)
- **Fullscreen ads in a React component with lifecycle state:** Options-form hooks: `useAppOpenAd` / `useInterstitialAd` / `useRewardedAd` / `useRewardedInterstitialAd`; Ad Manager interstitial with app events: `useGAMInterstitialAd` (`onAppEvent`)
- **App open ads on cold-start loading screen + warm foreground:** `useAppOpenAdManager` (`showAdIfAvailable()`; 4-hour freshness). Consent gate is `adUnitId: consentReady ? unitId : null` (or not mounting), **not** `autoLoad`: `showAdIfAvailable()` and warm foreground load even with `autoLoad: false`. Warm-foreground auto-show fires on any RN `background` → `active` (on Android this can include returning from another fullscreen ad), so also pass `null` while other fullscreen ads may show
- **One native ad owned by a component:** `useNativeAd` + `<NativeAdView>`
- **Keep fullscreen inventory warm; poll at show time:** Preload pools: `AdPoolPresets.fullscreen` + `AdPoolProvider` / `usePooledAd`, or `AdPools.create`
- **Keep display (banner/native) inventory warm:** `AdPoolPresets.display` + provider / `usePooledAd` (emulated, depth 1; see `resolved.degradeReasons`). Google Ad Manager unit required (for example `TestIds.GAM_NATIVE`); AdMob `ca-app-pub-…` units hard-error
- **One request, native _or_ banner winner:** `useMultiFormatAd` or `MultiFormatAdRequest` (+ `MultiFormatAdPresets.nativeOrBanner`). Google Ad Manager unit required (for example `TestIds.GAM_NATIVE`); AdMob units hard-error
- **Register test devices:** Emulators / simulators are automatic on every backend. Physical devices: copy the hashed id the SDK logs (logcat / Xcode console) into `testDeviceIdentifiers`. `TestDeviceIds.EMULATOR` is a classic-Android-only alias
- **Ask what this binary supports:** `getAdCapabilities()` (prefer presets over hand-rolled matrices)

Classic, hooks, and pools are **additive** — existing create/load/show keeps working. Details: [generated API reference](https://invertase.github.io/react-native-google-mobile-ads/), [Migrating to v17](https://docs.page/invertase/react-native-google-mobile-ads/migrating-to-v17), [Preload pools](https://docs.page/invertase/react-native-google-mobile-ads/preload-pools-and-multiformat-recipes).

---

## Consent before `initialize()`

Gather UMP/ATT consent and set request configuration **before** `mobileAds().initialize()`. Ads may preload on init. Check `AdsConsent` / `canRequestAds` when using European consent flows. See [Consent basics](https://docs.page/invertase/react-native-google-mobile-ads/consent-basics) and [European user consent](https://docs.page/invertase/react-native-google-mobile-ads/european-user-consent).

For options-form hooks (except `useAppOpenAdManager`): keep a real `adUnitId` once the placement exists; gate loading with `autoLoad: consentReady` (or call `load()` / `retry()` after consent). Putting consent only in `adUnitId` retires the placement when consent is false — that is a different policy. `useAppOpenAdManager` is the exception: gate it with `adUnitId: null` (or do not mount it), because `showAdIfAvailable()` and warm foreground start loads regardless of `autoLoad`.

For pools: `AdPools.create` initializes the SDK on Android and starts preloading, so create pools only after consent. Gate `AdPoolProvider` with `enabled={consentReady}` (default `true`); `false` stops future creates only and does not tear down existing pools.

---

## Hook `status` / `error` / `phase` and ownership

**Branch on `status`, not `error !== null`.** Options-form hooks populate `error` on both `'no-fill'` and `'error'`.

- **`status: 'no-fill'`:** Load-phase inventory emptiness (`no-fill` / `mediation-no-fill`) — routine, not a hard failure
- **`status: 'error'`:** Real failure; show-phase failures stay here even if the reason looks like inventory
- **`error.phase`:** `'load'` vs `'show'` (there is no `SHOW_FAILED` event — use `ERROR` with `phase: 'show'`)
- **`error.reason` / `code` / `message`:** Structured payload; include in bug reports when relevant

**`destroy()` / pool `release()` ownership**

- Options-form fullscreen hooks **own** the ad and never hand it out. Use the hook's own `destroy()` to reset to a fresh idle instance (does not auto-load), or leave cleanup to unmount. These hooks have no `release()`.
- Pool / multi-format hooks (`usePooledAd`, `useMultiFormatAd`): call **`release()`** before you `destroy()` yourself or if the ad must outlive the hook. After `release()`, **you** own `destroy()` and staleness. Pool `destroy()` does not tear down ads already polled out.
- Imperative `AdPools.create` / `MultiFormatAdRequest.load` callers own `destroy()` themselves.

---

## Canonical docs routes

Base: `https://docs.page/invertase/react-native-google-mobile-ads`

- **Getting Started:** `/`, `/prerequisites`, `/installation/expo`, `/installation/react-native`, `/configuration`, `/firebase`, `/consent-basics`, `/initialization`, `/first-ad`
- **Ad formats:** `/ad-formats`, `/ad-formats/{app-open,banner,interstitial,rewarded,rewarded-interstitial,native,hooks,ad-manager}`
- **Advanced:** `/preload-pools-and-multiformat-recipes`, `/next-gen-sdk`, `/mediation`, `/european-user-consent`, `/impression-level-ad-revenue`, `/revenue-telemetry-and-auction-diagnostics`, `/video-ad_volume-control`
- **Testing:** `/testing`, `/common-reasons-for-ads-not-showing`, `/ad-inspector`
- **Reference:** External [Reference API](https://invertase.github.io/react-native-google-mobile-ads/), `/config-plugin`, `/ai-agents`
- **Migration:** `/migrating-to-v17` (and older `/migrating-to-v{15,6,5}`)

Use the paths above. `/displaying-ads`, `/displaying-ads-hook`, `/native-ads`, and `/rngma-v17-api-reference` are retired routes; their content lives under `/ad-formats/*` and the external Reference API.

---

## Reporting issues

File on [GitHub Issues](https://github.com/invertase/react-native-google-mobile-ads/issues). Prefer fixing the **app** integration; do **not** clone this library’s monorepo unless you are contributing a verified library bug with a failing test.

**Always attach:** RN / Expo SDK versions, `react-native-google-mobile-ads` version, iOS/Android, New Architecture on (required), ad unit type, whether test IDs / test devices were used, and a **minimal reproduction** (smallest app or Snack/repo that shows the bug).

**Diagnostics dump:** attach the per-bug-kind details (Ad Inspector outcome, summarized `ResponseInfo`, `getAdCapabilities()` output, structured error fields) listed in [Migrating to v17 § Diagnostics dump for issue reports](https://docs.page/invertase/react-native-google-mobile-ads/migrating-to-v17#diagnostics-dump-for-issue-reports).

Rule out config first: [Common reasons ads do not show](https://docs.page/invertase/react-native-google-mobile-ads/common-reasons-for-ads-not-showing), [Testing](https://docs.page/invertase/react-native-google-mobile-ads/testing).

---

## Upstream Google agent skills (native SDK)

Google publishes **native** Google Mobile Ads agent skills (not React Native):

- Repo: [github.com/google/skills](https://github.com/google/skills) (`skills/ads/…`, `google-mobile-ads-*`)
- Install: `npx skills add google/skills/skills/ads`
- Docs: [iOS agent skills](https://developers.google.com/admob/ios/agent-skills), [Android / Next-Gen agent skills](https://developers.google.com/admob/android/next-gen/agent-skills)

**Caveats:**

- Those skills target the **native** Android/iOS (and Next-Gen) SDKs. This package is a **React Native layer** over those SDKs. Verify every upstream tip against this library’s public JS API and these docs before applying it. When unsure, prefer this file and [docs.page](https://docs.page/invertase/react-native-google-mobile-ads). Official product docs: [developers.google.com/admob](https://developers.google.com/admob).
- Do not apply native SDK migration skills (for example `google-mobile-ads-android-migrate-to-next-gen`) to a React Native app. This library selects classic or Next-Gen Android at build time; switching is a config option, not a native code rewrite. See [GMA Next-Gen SDK (Android)](https://docs.page/invertase/react-native-google-mobile-ads/next-gen-sdk). This package ships no migrate-to-Next-Gen skill of its own.
- The install command also adds skills unrelated to Google Mobile Ads (Google Ads API, Data Manager API, IMA SDK). Ignore them for ad integration.
