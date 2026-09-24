# React Native Google Mobile Ads — integrator agents

You are helping a developer **integrate** `react-native-google-mobile-ads` into an app.
This file ships inside the npm package (`node_modules/react-native-google-mobile-ads/AGENTS.md`).

**Canonical docs (prefer these over inventing APIs):**
[https://docs.page/invertase/react-native-google-mobile-ads](https://docs.page/invertase/react-native-google-mobile-ads)
· [For AI agents](https://docs.page/invertase/react-native-google-mobile-ads/ai-agents)
(append `.md` to any docs.page URL for plain Markdown).

**Not for you:** the GitHub repo-root `AGENTS.md` is maintainer/contributor steering for this library’s development. Do not follow it when integrating into an app.

Use `mobileAds()` (not a capital-`MobileAds()` constructor). Prefer the v17 **options-form** fullscreen hooks over deprecated positional hooks.

---

## v17: which API to use

| Need | Use |
| ---- | --- |
| Simple create → load → show, or `<BannerAd>` / `NativeAd` | Classic APIs (no pool, no provider) |
| Fullscreen ads in a React component with lifecycle state | Options-form hooks: `useAppOpenAd` / `useInterstitialAd` / `useRewardedAd` / `useRewardedInterstitialAd` |
| Keep fullscreen inventory warm; poll at show time | Preload pools: `AdPoolPresets.fullscreen` + `AdPoolProvider` / `usePooledAd`, or `AdPools.create` |
| Keep display (banner/native) inventory warm | `AdPoolPresets.display` + provider / `usePooledAd` (depth 1 / emulated preload today) |
| One request, native **or** banner winner | `useMultiFormatAd` or `MultiFormatAdRequest` (+ `MultiFormatAdPresets.nativeOrBanner`) |
| Ask what this binary supports | `getAdCapabilities()` (prefer presets over hand-rolled matrices) |

Classic, hooks, and pools are **additive** — existing create/load/show keeps working. Details: [v17 API reference](https://docs.page/invertase/react-native-google-mobile-ads/rngma-v17-api-reference), [Migrating to v17](https://docs.page/invertase/react-native-google-mobile-ads/migrating-to-v17), [Preload pools](https://docs.page/invertase/react-native-google-mobile-ads/preload-pools-and-multiformat-recipes).

---

## Consent before `initialize()`

Gather UMP/ATT consent and set request configuration **before** `mobileAds().initialize()`. Ads may preload on init. Check `AdsConsent` / `canRequestAds` when using European consent flows. See [Consent basics](https://docs.page/invertase/react-native-google-mobile-ads/consent-basics) and [European user consent](https://docs.page/invertase/react-native-google-mobile-ads/european-user-consent).

For options-form hooks: keep a real `adUnitId` once the placement exists; gate loading with `autoLoad: consentReady` (or call `load()` / `retry()` after consent). Putting consent only in `adUnitId` retires the placement when consent is false — that is a different policy.

---

## Hook `status` / `error` / `phase` and ownership

**Branch on `status`, not `error !== null`.** Options-form hooks populate `error` on both `'no-fill'` and `'error'`.

| Signal | Rule |
| ------ | ---- |
| `status: 'no-fill'` | Load-phase inventory emptiness (`no-fill` / `mediation-no-fill`) — routine, not a hard failure |
| `status: 'error'` | Real failure; show-phase failures stay here even if the reason looks like inventory |
| `error.phase` | `'load'` vs `'show'` (there is no `SHOW_FAILED` event — use `ERROR` with `phase: 'show'`) |
| `error.reason` / `code` / `message` | Structured payload; include in bug reports when relevant |

**`destroy()` / pool `release()` ownership**

- Options-form fullscreen hooks **own** the ad. Do not `destroy()` inventory the hook still owns if you need a consistent `status`. Call `destroy()` to reset to a fresh idle instance (does not auto-load), or leave cleanup to unmount.
- Pool / multi-format hooks (`usePooledAd`, `useMultiFormatAd`): call **`release()`** before you `destroy()` yourself or if the ad must outlive the hook. After `release()`, **you** own `destroy()` and staleness. Pool `destroy()` does not tear down ads already polled out.
- Imperative `AdPools.create` / `MultiFormatAdRequest.load` callers own `destroy()` themselves.

---

## Canonical docs routes

Base: `https://docs.page/invertase/react-native-google-mobile-ads`

| Area | Paths |
| ---- | ----- |
| Getting Started | `/`, `/prerequisites`, `/installation/expo`, `/installation/react-native`, `/configuration`, `/firebase`, `/initialization`, `/consent-basics`, `/first-ad` |
| Ad formats | `/ad-formats`, `/ad-formats/{app-open,banner,interstitial,rewarded,rewarded-interstitial,native,hooks,ad-manager}` |
| Advanced | `/preload-pools-and-multiformat-recipes`, `/mediation`, `/european-user-consent`, `/impression-level-ad-revenue`, `/revenue-telemetry-and-auction-diagnostics`, `/video-ad_volume-control` |
| Testing | `/testing`, `/common-reasons-for-ads-not-showing`, `/ad-inspector` |
| Reference | `/rngma-v17-api-reference`, `/config-plugin`, `/ai-agents` |
| Migration | `/migrating-to-v17` (and older `/migrating-to-v{15,6,5}`) |

Old paths `/displaying-ads`, `/displaying-ads-hook`, `/native-ads` redirect; prefer the `/ad-formats/*` URLs above.

---

## Reporting issues

File on [GitHub Issues](https://github.com/invertase/react-native-google-mobile-ads/issues). Prefer fixing the **app** integration; do **not** clone this library’s monorepo unless you are contributing a verified library bug with a failing test.

**Always attach:** RN / Expo SDK versions, `react-native-google-mobile-ads` version, iOS/Android, New Architecture on (required), ad unit type, whether test IDs / test devices were used, and a **minimal reproduction** (smallest app or Snack/repo that shows the bug).

**Diagnostics dump** (from [Migrating to v17](https://docs.page/invertase/react-native-google-mobile-ads/migrating-to-v17)):

| Kind of bug | Include |
| ----------- | ------- |
| Classic load / show / fill | [Ad Inspector](https://docs.page/invertase/react-native-google-mobile-ads/ad-inspector) outcome, ad unit, test device, platform SDK version |
| Auction / mediation mix | Summarized load-time `ResponseInfo` |
| Pools / multi-format / preload | `JSON.stringify(getAdCapabilities(), null, 2)` |
| Structured error handling | `reason`, `phase`, `code`, `message`, and whether `responseInfo` was present |

Rule out config first: [Ads not showing](https://docs.page/invertase/react-native-google-mobile-ads/common-reasons-for-ads-not-showing), [Testing](https://docs.page/invertase/react-native-google-mobile-ads/testing).

---

## Upstream Google agent skills (native SDK)

Google publishes **native** Google Mobile Ads agent skills (not React Native):

- Repo: [github.com/google/skills](https://github.com/google/skills) (`skills/ads/…`, `google-mobile-ads-*`)
- Install: `npx skills add google/skills/skills/ads`
- Docs: [iOS agent skills](https://developers.google.com/admob/ios/agent-skills), [Android / Next-Gen agent skills](https://developers.google.com/admob/android/next-gen/agent-skills)

**Caveat:** those skills target the **native** Android/iOS (and Next-Gen) SDKs. This package is a **React Native layer** over those SDKs. Verify every upstream tip against this library’s public JS API and these docs before applying it. When unsure, prefer this file and [docs.page](https://docs.page/invertase/react-native-google-mobile-ads). Official product docs: [developers.google.com/admob](https://developers.google.com/admob).
