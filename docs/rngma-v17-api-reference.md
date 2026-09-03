# React Native Google Mobile Ads v17 API reference

Single-file reference for the public TypeScript surface of `react-native-google-mobile-ads`.
Covers today’s source-compatible shims plus the additive v17 types and stubs
(`getAdCapabilities`, `AdPools`, `MultiFormatAdRequest`, `MultiFormatBannerAdView`, presets, and hooks).

> **Status:** types and minimal runtime stubs. Native preload / multi-format load /
> pool wiring lands in later work. Stub methods no-op, resolve an empty outcome,
> or reject as documented below.

---

## Contents

- [Which API to reach for](#which-api-to-reach-for)
- [ELI5: what the new APIs are for](#eli5-what-the-new-apis-are-for)
- [Compatibility](#compatibility)
- [Installation surface (unchanged)](#installation-surface-unchanged)
- [Module / consent / request (shim)](#module--consent--request-shim)
- [Fullscreen ads (shim)](#fullscreen-ads-shim)
  - [Fullscreen hooks: two call forms](#fullscreen-hooks-two-call-forms-additive)
- [Banner ads (shim)](#banner-ads-shim)
- [Native ads (shim)](#native-ads-shim)
- [Capability discovery (new)](#capability-discovery-new)
- [Multi-format request (new)](#multi-format-request-new)
- [Ad pools (new)](#ad-pools-new)
  - [Availability (`getAvailability`)](#availability-getavailability)
  - [Expiry: two different scopes](#expiry-two-different-scopes)
- [Presets (new)](#presets-new)
- [Hooks / provider (new)](#hooks--provider-new)
- [Metadata (additive)](#metadata-additive)
- [Error payload (additive)](#error-payload-additive)
  - [Errors versus response records](#errors-versus-response-records)
- [Config defaults and `adServer` asymmetry](#config-defaults-and-adserver-asymmetry)
- [Usage examples](#usage-examples)
- [Migration sketches](#migration-sketches)
- [First failure modes](#first-failure-modes)
- [Out of this surface (v1)](#out-of-this-surface-v1)

---

## Which API to reach for

| Need | Reach for |
| ---- | --------- |
| Keep today's create/load/show or `<BannerAd>` / `NativeAd` | Existing shims (no provider, no pool) |
| Warm fullscreen inventory and poll at show time | `AdPoolPresets.fullscreen` + `AdPoolProvider` / `usePooledAd`, or imperative `AdPools.create` |
| Warm display (native/banner) inventory | `AdPoolPresets.display` + provider / `usePooledAd` (depth 1 / emulated preload today) |
| One request, native **or** banner winner (count 1) | `useMultiFormatAd` or `MultiFormatAdRequest` (+ `MultiFormatAdPresets.nativeOrBanner`) |
| Ask what this binary can do | `getAdCapabilities()` (prefer presets over hand-rolled matrices) |

Details and ownership rules live in the sections below. Expiry and staleness are stated once in [Expiry: two different scopes](#expiry-two-different-scopes).

## ELI5: what the new APIs are for

Today’s APIs still work: create an ad, load it, show it (or mount a banner). The new surface adds two ideas on top of that, without forcing you to rewrite existing screens.

### Multi-format ads: “ask for a few formats, keep the winner”

Sometimes you do not care whether the fill is a **native** ad or a **banner**, you just want the best one Google returns for that placement. A **multi-format request** is one AdLoader-style call that lists the formats you will accept (in v1: native and/or GAM banner, **count 1**). You specify:

- the **ad unit**
- which **formats** compete (`native`, `banner`, or both)
- for banners, which **sizes** are legal for that request (typed sizes; adaptive / `FLUID` are rejected because there is no view width yet)

**Multi-format is not multi-count.** Multi-format means _several formats compete for one ad_. Multi-count (several ads returned from one request, via `numberOfAds` / `requestCount`) is **out of v1** and unsupported on mediated units.

You get back one handle (or errors). Render a native winner with `<NativeAdView>`; render a banner winner with `<MultiFormatBannerAdView>` (attach-only: it does not load again). In React, `useMultiFormatAd` owns that load lifecycle; imperatively, use `MultiFormatAdRequest`.

Use this when the UI can show either shape. Skip it when you already know you only want a banner component or only a native layout.

### Ad pools: “keep something ready, refill when you take one”

A **pool** is a named buffer of ads for a placement (`poolId` + formats + unit). When you need an ad, you **`poll()`** one out; the pool is designed to refill in the background. Depending on the **backend and formats**, that buffer may:

- **preload** via the platform SDK preloader when Google supports it, which today means interstitial, rewarded and app open on both classic backends, plus **rewarded interstitial on iOS only**: Android's preload registry has no slot for that format and rejects it,
- hold **more than one** ready ad **on those fullscreen formats**, where Google recommends a buffer of 2 per preload ID under an app-wide cap the SDK resolves at runtime from server-delivered settings, which is why `maxManagedPoolAds` is reported as `null` rather than a number,
- or fill using **multi-format requests** inside the pool when the formats are native/banner and that is the honest way to request them,
- or run as a depth-1 self-refill when there is no SDK display preloader. That is the case for **banner and native on both classic backends**: neither iOS nor classic Android ships a display preloader. Create still reports `degraded: true` with reason `'pool/emulated-no-sdk-preloader'`, matching `getAdCapabilities().displayPreload === 'emulated'`. The token `emulated` is a capability / reason value, not a field on `AdPool` or `resolved`.

So buffer depth greater than 1 is a **fullscreen** capability today. A display pool asking for depth clamps to 1 and tells you it did; see the degrade example below.

Ads do not stay usable forever, and what the library can honestly tell you about that is narrower than it looks and depends on who loaded the ad. The publisher-policy staleness surface is the **current** contract, stated in exactly one place: [Expiry: two different scopes](#expiry-two-different-scopes).

`AdPoolProvider` only **owns** those pools for a React tree of children. Child screens look them up by the same `poolId` (`useAdPool` / `usePooledAd`), then poll and show/render. You can also call `AdPools.create` yourself. You can also use **neither** pools nor multi-format APIs and stay on the classic create/load/show path.

### Not every permutation is possible, and that is checked up front

Google’s SDKs do not support every combination of format × buffer size × preload × multi-format × mediation. Mixing fullscreen with display in one pool, asking for buffer depths the backend cannot honor, illegal banner sizes in a multi-format request, or formats that are simply `unavailable` on this binary are examples of things that **cannot** all be true at once.

So the library does **not** ask you to memorize the matrix. At create time it is designed to validate the config against what this app can actually do:

- **`AdPools.create(config)`** returns `Promise<AdPool>` and **rejects** when the request is impossible (e.g. a format would be dropped, unsupported mix). Catch with `.catch()` / `try` around `await`.
- **`MultiFormatAdRequest.create(config)`** is synchronous. **The stub currently stores the config without validation.** The wired implementation is intended to throw when the request is impossible (for example, an illegal size); add `try/catch` when adopting that implementation.
- **Loud degrade** when a milder adjustment is safe (e.g. clamp buffer size, display preload without an SDK preloader); you see that on `resolved` / `degraded` / `degradeReasons`, and in `__DEV__` the library logs a one-time warning that the config leads to degraded mode.

Presets (`AdPoolPresets`, `MultiFormatAdPresets`) aim to request only configs that survive the wired checks. `AdPools.create` validates today; the multi-format stub does not yet validate either preset or hand-written configs.

None of the additive pool / multi-format / hook paths are wired to native yet. Each section below states what the stub does today (no-op, empty outcome, or reject).

---

## Compatibility

- Existing class, hook, and component **names and call shapes are kept**.
- New APIs are **additive**.
- Load / show / event patterns for fullscreen, banner, and native ads do not require a rewrite.
- The four fullscreen hooks gain a **second call form** rather than changing the first. Passing an options object opts into the v17 shape; passing the existing arguments behaves exactly as it did. The positional form is deprecated in v17 and removed in version 18. See [Fullscreen hooks: two call forms](#fullscreen-hooks-two-call-forms-additive).

---

## Installation surface (unchanged)

```ts
import mobileAds, {
  InterstitialAd,
  BannerAd,
  NativeAd,
  useInterstitialAd,
  TestIds,
  // …
} from 'react-native-google-mobile-ads';
```

---

## Module / consent / request (shim)

| Export                          | Notes                                                                                                                                                                                                                                     |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mobileAds()` / `MobileAds()`   | `initialize()`, volume/mute, request configuration, ad inspector; additive stubs (no-op / JS package version today): `disableMediationAdapterInitialization`, `disableSdkCrashReporting`, `setPublisherFirstPartyIdEnabled`, `getVersion` |
| `NativeError`                   | Public `Error` subclass. Legacy code paths use it directly; the v17 hooks use `AdError`, which is `NativeError` plus the structured payload                                                                                               |
| `AdsConsent`                    | UMP consent flow (unchanged)                                                                                                                                                                                                              |
| `MaxAdContentRating`, `TestIds` | Unchanged                                                                                                                                                                                                                                 |
| `RequestOptions`                | Additive: `categoryExclusions?: string[]` (GAM-only)                                                                                                                                                                                      |
| `RequestConfiguration`          | Additive: `publisherPrivacyPersonalizationState?: 'enabled' \| 'disabled' \| 'unset'`                                                                                                                                                     |
| `AdapterStatus`                 | Additive optional `latencyMillis`                                                                                                                                                                                                         |

---

## Fullscreen ads (shim)

Classes: `AppOpenAd`, `InterstitialAd`, `RewardedAd`, `RewardedInterstitialAd`, `GAMInterstitialAd`.

```ts
const ad = InterstitialAd.createForAdRequest(adUnitId, requestOptions?);
ad.load();
ad.show(options?);
ad.loaded;
ad.addAdEventListener / addAdEventsListener / removeAllListeners
```

**Additive on the same objects:**

| Member            | Type                                          |
| ----------------- | --------------------------------------------- |
| `ad.destroy()`    | `void`, releases native listeners; idempotent |
| `ad.responseInfo` | `ResponseInfo \| null`, snapshot after load   |

**Events (`AdEventType`):**

| Event                                                    | Notes                                                                             |
| -------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `LOADED`, `OPENED`, `CLOSED`, `CLICKED`, `PAID`, `ERROR` | Existing                                                                          |
| `IMPRESSION`                                             | Additive; no payload                                                              |
| `ERROR`                                                  | Keeps `code` / `message`; gains structured `reason` + `phase` (see Error payload) |

Hooks: `useAppOpenAd`, `useInterstitialAd`, `useRewardedAd`, `useRewardedInterstitialAd`, `useForeground`.

### Fullscreen hooks: two call forms (additive)

Each of the four fullscreen hooks accepts either the version 16 positional arguments or a single options object. The form you pass selects the result shape, so nothing about the existing form changes.

```ts
// Form 1 — unchanged. Deprecated in v17, removed in version 18.
useInterstitialAd(adUnitId: string | null, requestOptions?: RequestOptions): AdHookReturns;

// Form 2 — opt in by passing one object.
useInterstitialAd(options: UseInterstitialAdOptions): UseInterstitialAdResult;

type FullScreenAdHookOptions = {
  adUnitId: string | null; // null: no unit yet, no instance, status stays 'idle'
  requestOptions?: RequestOptions;
  autoLoad?: boolean; // default true; controls automatic loading, never identity
};

// Per-hook aliases; the options type is shared so `autoLoad` means one thing.
type UseInterstitialAdOptions = FullScreenAdHookOptions;
type UseAppOpenAdOptions = FullScreenAdHookOptions;
type UseRewardedAdOptions = FullScreenAdHookOptions;
type UseRewardedInterstitialAdOptions = FullScreenAdHookOptions;
```

**Why an overload rather than a new default.** In the options form `autoLoad` can default to `true` and load on its own at no risk, because no existing caller can reach that form without rewriting the call. Changing the positional form's behavior instead would have been a silent break for every app that mounts a hook and defers `load()` until consent resolves.

**What the options form returns.** `status` answers where the ad is right now and is mutually exclusive. The fields beside it answer what has already happened to the ad and accumulate, because those facts genuinely overlap: a user can click an ad and then dismiss it, and a paid event can arrive at any point. Everything in the second group resets when the next `load()` starts and when `adUnitId` or `requestOptions` changes.

```ts
type UseFullScreenAdStatus =
  | 'idle' // nothing attempted yet, including while adUnitId is null
  | 'loading' // load in flight
  | 'loaded' // ready to show
  | 'showing' // presented, not yet dismissed
  | 'closed' // dismissed; this ad is spent
  | 'no-fill' // ad server returned nothing; routine, not a failure
  | 'error'; // load or show actually failed

type UseFullScreenAdResultBase = {
  autoLoad: boolean; // resolved policy, so a permanent 'idle' is diagnosable

  // Retained facts. Reset on the next load() and on identity/request changes.
  clicked: boolean;
  impression: boolean;
  revenue: PaidEvent | null;
  responseInfo: ResponseInfo | null;
  reward: RewardedAdReward | null; // rewarded hooks only
  earnedReward: boolean; // rewarded hooks only

  load: () => void; // coalesces per instance; void, because status is the channel
  show: (showOptions?: AdShowOptions) => void;
  destroy: () => void;
  retry: () => void; // alias for load, named for the error-path call site
};

type UseFullScreenAdResult = UseFullScreenAdResultBase &
  {
    [Status in UseFullScreenAdStatus]: {
      status: Status;
      error: Status extends 'no-fill' | 'error' ? AdError : null;
    };
  }[UseFullScreenAdStatus];

// Interstitial and app open omit the reward members, the same way
// `AdHookReturns` is already Omit'd on those two hooks today.
type WithoutReward<T> = T extends unknown ? Omit<T, 'reward' | 'earnedReward'> : never;
type UseInterstitialAdResult = WithoutReward<UseFullScreenAdResult>;
type UseAppOpenAdResult = WithoutReward<UseFullScreenAdResult>;
type UseRewardedAdResult = UseFullScreenAdResult;
type UseRewardedInterstitialAdResult = UseFullScreenAdResult;
```

**Automatic loading.** The options form loads when it mounts with a non-null `adUnitId`, when `autoLoad` flips from false to true, and when `adUnitId` or `requestOptions` replaces the ad with a new instance. It deliberately does **not** load again after `'closed'`, `'error'`, or `'no-fill'`: reloading a spent ad produces fills nobody asked for and depresses match rate, and auto-retrying a failure is a request storm. Call `retry()` for the failure paths, and see [Reloading after dismissal](#reloading-after-dismissal) for the next-impression pattern.

**`autoLoad` is a policy, not a second placement identity.** Turning it off stops future automatic loads. It does not destroy the ad, and it does not cancel a load already in flight, because neither platform exposes load cancellation. An explicit `load()` or `retry()` still works while `autoLoad` is false.

**Deprecation.** The positional overload carries `@deprecated`, so editors strike it through at the call site while the options form stays clean. First use in `__DEV__` also logs a one-time warning once per hook. Removal is version 18.

#### A deferred ad unit id

`adUnitId: null` exists for the case where the unit is not known yet: a remote config value, a per-placement lookup, a route parameter that has not resolved. You do not need to manage that state yourself, because whatever supplies the id already owns its own loading state:

```tsx
// Any query hook, Remote Config listener, or store selector works the same way.
const { data: adUnitId } = useQuery({ queryKey: ['adUnit'], queryFn: getAdUnitIdFromServer });

const { status, show } = useInterstitialAd({
  adUnitId: adUnitId ?? null, // still resolving: no instance, status stays 'idle'
  autoLoad: consentReady,
});
```

Changing an existing identity to `null` destroys its ad instance, unsubscribes
from that instance's events, and resets lifecycle state to `'idle'`. Changing to
a different string or changing `requestOptions` also destroys and replaces the
previous instance.

**These controls are orthogonal.** `adUnitId` answers which placement exists. `autoLoad` answers whether the hook should load that placement by itself. A null unit means no ad instance exists, so the hook reports `'idle'` regardless of `autoLoad`; that is why the snippet above uses consent only for the automatic-load policy and does not need to keep two conditions in sync. If consent loss should retire the placement entirely rather than preserve its current instance, putting the condition in `adUnitId` is intentionally different:

```tsx
useInterstitialAd({
  adUnitId: consentReady ? (adUnitId ?? null) : null, // retire on consent loss
});
```

`useMultiFormatAd` requires a string because its `MultiFormatAdConfig` is also accepted by the imperative `MultiFormatAdRequest.create`. If its id is remote, use a component boundary so the hook only mounts once the request can be described:

```tsx
function RemoteMultiFormatSlot({ consentReady }: { consentReady: boolean }) {
  const { data: adUnitId } = useQuery({
    queryKey: ['multi-format-ad-unit'],
    queryFn: getAdUnitIdFromServer,
  });

  if (!adUnitId) return <ActivityIndicator />;
  return <MultiFormatSlot adUnitId={adUnitId} consentReady={consentReady} />;
}

function MultiFormatSlot(props: { adUnitId: string; consentReady: boolean }) {
  const ad = useMultiFormatAd({
    adUnitId: props.adUnitId,
    requestOptions: MultiFormatAdPresets.nativeOrBanner([BannerAdSize.MEDIUM_RECTANGLE]),
    autoLoad: props.consentReady,
  });
  return ad.status === 'loading' ? <ActivityIndicator /> : null; // render from ad.status
}
```

Resolving the id is deliberately not the hook's job. Handing it a function to await would fold two different async systems into one `status`, and a rejection from your own code carries none of the `reason` / `phase` / `responseInfo` an `AdError` promises (see [Errors versus response records](#errors-versus-response-records)).

**Implementation note:** both call forms use the same underlying `MobileAd` lifecycle. The options form adds automatic loading, the discriminated status result, and ownership cleanup on unmount; the positional form retains its existing manual-load and unmount behavior until removal.

---

## Banner ads (shim)

Components: `<BannerAd>`, `<GAMBannerAd>`.

**Additive callbacks:**

- `onAdLoaded` dimensions may include `responseInfo?: ResponseInfo`
- `onAdFailedToLoad` may carry `AdErrorPayload` fields (`reason`, `phase`) in addition to legacy `Error`. Typed as `Error & Partial<AdErrorPayload>` so existing `(error: Error) => void` handlers stay assignable under `strictFunctionTypes`, unlike hook / event surfaces where `reason` and `phase` are required.

Sizes: `BannerAdSize`, `GAMBannerAdSize` (unchanged).

---

## Native ads (shim)

- `NativeAd.createForAdRequest` → `Promise<NativeAd>`
- `<NativeAdView>`, `<NativeAsset>`, `<NativeMediaView>`
- `destroy()` on the native ad instance

Top-level `responseId` remains the registry key. Additive member: `nativeAd.responseInfo: ResponseInfo | null` (null until native wiring).

---

## Capability discovery (new)

```ts
type AdBackend = 'ios' | 'android-classic' | 'android-next-gen';

enum AdFormat {
  APP_OPEN = 'appOpen',
  INTERSTITIAL = 'interstitial',
  REWARDED = 'rewarded',
  REWARDED_INTERSTITIAL = 'rewardedInterstitial',
  BANNER = 'banner',
  NATIVE = 'native',
}

type FullscreenAdFormat =
  | AdFormat.APP_OPEN
  | AdFormat.INTERSTITIAL
  | AdFormat.REWARDED
  | AdFormat.REWARDED_INTERSTITIAL;

type CapabilitySupport = 'supported' | 'emulated' | 'degraded' | 'experimental' | 'unavailable';

type AdCapabilities = {
  backend: AdBackend;
  sdkVersion: string; // linked native SDK version
  formats: Record<AdFormat, CapabilitySupport>;
  multiFormatNativeBanner: CapabilitySupport;
  fullscreenPreload: CapabilitySupport; // coarse rollup; prefer fullscreenPreloadFormats
  fullscreenPreloadFormats: Record<FullscreenAdFormat, CapabilitySupport>;
  displayPreload: CapabilitySupport;
  multiCountNative: CapabilitySupport;
  /** Classic Android: unavailable. Classic iOS: supported when wired. */
  poolResponseInfoPeek: CapabilitySupport;
  maxManagedPoolAds: number | null; // always null: cap is server-delivered
  mediation: 'unknown' | 'known-enabled' | 'known-disabled';
};

function getAdCapabilities(): AdCapabilities;
```

- Synchronous; safe before `initialize()`.
- **Stub today:** returns placeholder values: `backend: 'android-classic'`, `sdkVersion: '0.0.0-stub'`, every format and capability as `unavailable`, `maxManagedPoolAds: null`, `mediation: 'unknown'`. These are not live device/SDK capability readings.
- Prefer **presets** for common cases; do not re-implement capability matrices in app code.
- Gate rewarded interstitial pooling with `fullscreenPreloadFormats[AdFormat.REWARDED_INTERSTITIAL]` before `AdPools.create`: on Android classic that format is `unavailable` and create hard-errors with reason `'pool/format-preload-unsupported'`.
- Gate `AdPool.peekResponseInfo()` with `poolResponseInfoPeek`: classic Android is `unavailable` (no peek API) and peek hard-errors with `'pool/peek-unsupported'`; classic iOS is `supported` when wired. A resolved `null` means empty head only on a supported backend, never "unsupported".
- When native-wired, classic fullscreen preload may report `experimental` while upstream preload APIs remain beta. `experimental` means maturity, not a veto of a supported path.
- **Anti-pattern:** do not pre-flight-branch on the full capability matrix before every call. Use presets / hard-errors at `create()`, and reserve capability reads for UI gating or diagnostics.

---

## Multi-format request (new)

One AdLoader-style request. Count **1**. Formats: native and/or GAM banner.

```ts
type MultiFormatAdFormat = AdFormat.NATIVE | AdFormat.BANNER;

type MultiFormatBannerSize =
  | BannerAdSize.BANNER
  | BannerAdSize.FULL_BANNER
  | BannerAdSize.LARGE_BANNER
  | BannerAdSize.LEADERBOARD
  | BannerAdSize.MEDIUM_RECTANGLE
  | BannerAdSize.WIDE_SKYSCRAPER // mediation-only; not served by the Google network
  | `${number}x${number}` // custom, e.g. "300x200"
  | { width: number; height: number }; // custom object form

type MultiFormatAdRequestOptions = RequestOptions & {
  formats: MultiFormatAdFormat[];
  bannerSizes?: MultiFormatBannerSize[]; // required when banner is requested
  requestCount?: 1;
  adServer?: 'ad-manager';
  stalenessWindowMillis?: number; // publisher policy; defaults to guidance/other
};

// Module-local composition helper (not exported). Consumers import
// `MultiFormatAdHandle`. Shared with pooled ads: same identity, same policy
// surface, same words.
type MultiFormatAdHandleBase = AdIdentity &
  AdExpiry & {
    provenance: 'pool/emulated-no-sdk-preloader'; // library-performed load
    responseInfo: ResponseInfo | null;
    destroy(): void; // on the native arm this destroys the inner `ad` too
  };

type MultiFormatAdHandle =
  | (MultiFormatAdHandleBase & { format: AdFormat.NATIVE; ad: NativeAd })
  | (MultiFormatAdHandleBase & {
      format: AdFormat.BANNER;
      size: { width: number; height: number };
    });

// Outcome of one load, resolved by `useMultiFormatAd().load()`. The status
// values are the terminal subset of `UseMultiFormatAdStatus` (exported), so
// hook state and the resolved result use the same words.
type MultiFormatLoadResult = {
  // On every arm, including 'no-fill': a response record is not a failure, so
  // it does not belong in `errors`. See "Errors versus response records".
  responseInfo: ResponseInfo | null;
} & (
  | { status: 'loaded'; ads: MultiFormatAdHandle[]; errors: never[] }
  | { status: 'loaded-partial'; ads: MultiFormatAdHandle[]; errors: AdError[] }
  | { status: 'no-fill'; ads: never[]; errors: never[] } // routine, not a failure
  | { status: 'error'; ads: never[]; errors: AdError[] }
);

// The ad unit plus the request. `MultiFormatAdRequest.create` and
// `useMultiFormatAd` accept this same object, the way `AdPools.create` and
// `AdPoolProvider` share `AdPoolConfig`.
//
// `requestOptions` is nested rather than spread flat so hook-level fields and
// request-level fields can never grow into each other: a new
// `MultiFormatAdRequestOptions` field can never collide with a hook option
// name. The key matches `AdPoolConfig.requestOptions`.
type MultiFormatAdConfig = {
  adUnitId: string;
  requestOptions: MultiFormatAdRequestOptions;
};

class MultiFormatAdRequest {
  readonly adUnitId: string;
  readonly options: MultiFormatAdRequestOptions;
  // Stub today stores config without validation; wired behavior will reject illegal config.
  static create(config: MultiFormatAdConfig): MultiFormatAdRequest;
  load(): Promise<{
    ads: MultiFormatAdHandle[];
    errors: AdError[];
    responseInfo: ResponseInfo | null;
  }>;
  destroy(): void;
}
```

**Stub:** `load()` rejects with `"MultiFormatAdRequest.load is not implemented"`.

A load never resolves `stale-by-policy` (library-performed load; observed time starts at hand-off). Provenance, ownership, and staleness rules: [Expiry: two different scopes](#expiry-two-different-scopes).

The imperative `load()` resolves the raw triple rather than a `MultiFormatLoadResult`, so there is no `status` word on that path: both arrays empty is a clean no-fill, a non-empty `errors` with a handle is the partial case, and a non-empty `errors` with no handle is a failure. `responseInfo` is populated even on a clean no-fill (see [Errors versus response records](#errors-versus-response-records)). `MultiFormatLoadResult` is what `useMultiFormatAd().load()` resolves.

**Render:** native handle → existing `<NativeAdView>` via `handle.ad`. Banner handle → new `<MultiFormatBannerAdView handle={...} />` (attach-only; does not issue a second load). `handle` is typed as `MultiFormatBannerAdHandle` (banner-only extract of `MultiFormatAdHandle`); non-banner handles are a TypeScript error.

```tsx
import {
  MultiFormatBannerAdView,
  type MultiFormatBannerAdHandle,
} from 'react-native-google-mobile-ads';

declare const bannerHandle: MultiFormatBannerAdHandle;
<MultiFormatBannerAdView handle={bannerHandle} />;
```

**Stub:** empty `View` until native attach lands. No runtime format check; the prop type enforces banner handles.

Illegal in v1, split by enforcement:

- **Rejected by the type system** (do not type-check as `MultiFormatBannerSize` / `requestCount?: 1`): adaptive sizes, `FLUID`, `requestCount` other than `1`.
- **Hard-error at create time when wired** (types still admit the shape): empty `formats`, banner format without `bannerSizes`.

---

## Ad pools (new)

```ts
type AdPoolConfig = {
  poolId: string;
  formats: AdFormat[];
  adUnitId: string;
  requestOptions?: RequestOptions;
  bufferSize?: number;
  pollTimeoutMillis?: number;
  stalenessWindowMillis?: number; // publisher policy; defaults from guidance
  adServer?: 'ad-manager' | 'admob';
  mediation?: 'unknown' | 'known-enabled' | 'known-disabled';
  bannerSizes?: MultiFormatAdRequestOptions['bannerSizes'];
};

/** Preset override bag: omits formats and adUnitId so presets cannot be undercut. */
type AdPoolPresetOverrides = Omit<Partial<AdPoolConfig>, 'formats' | 'adUnitId'>;

/** Default poolId templates from AdPoolPresets (prefer config.poolId at both ends). */
type DisplayPoolId<TAdUnitId extends string = string> = `display-${TAdUnitId}`;
type FullscreenPoolId<
  TFormat extends FullscreenAdFormat = FullscreenAdFormat,
  TAdUnitId extends string = string,
> = `fullscreen-${TFormat}-${TAdUnitId}`;

type AdPoolDegradeReason =
  | 'pool/degraded-buffer-size'
  | 'pool/degraded-request-count'
  | 'pool/emulated-no-sdk-preloader'; // also the library-load provenance tag

type AdPoolResolvedConfig = AdPoolConfig & {
  requestedBufferSize?: number;
  effectiveBufferSize: number;
  effectiveStalenessWindowMillis: number;
  effectiveStalenessWindowSource: AdStalenessWindowSource;
  degraded: boolean;
  degradeReasons: AdPoolDegradeReason[];
};

// Identity, for correlation and diagnostics. Shared with multi-format handles.
type AdIdentity = {
  adId: string; // stable, unique within the app for this ad's lifetime
  observedAt: number | null; // library observation; null when never seen; see expiry section
};

type AdInventoryProvenance =
  | 'pool/emulated-no-sdk-preloader' // library-performed load
  | 'pool/sdk-managed-preloader'; // platform preloader handed over on poll

type AdStalenessWindowSource = 'configured' | 'guidance/app-open' | 'guidance/other';

// Google's published guidance figures used as publisher policy defaults when
// `stalenessWindowMillis` is omitted (not the SDK's cache timeout).
const AdStalenessGuidanceMillis = {
  APP_OPEN: 4 * 60 * 60 * 1000, // four hours
  OTHER: 60 * 60 * 1000, // one hour; Android interstitial figure is contested
} as const;

// Publisher-policy staleness on any inventory the consumer holds.
type AdExpiry = {
  stalenessWindowMillis: number;
  stalenessWindowSource: AdStalenessWindowSource;
  // False when observedAt is null (unknown age is not treated as stale).
  isStaleByPolicy(): boolean;
  // Sync-fires once if already stale on subscribe; never fires while
  // observedAt is null; destroy() releases listeners (later unsub is a no-op).
  onStaleByPolicy(listener: () => void): () => void;
};

// Kept as aliases so the pooled-ad vocabulary still reads naturally.
type PooledAdIdentity = AdIdentity;
type PooledAdExpiry = AdExpiry;

// Module-local composition helper (not exported). Consumers import `PooledAd`.
type PooledAdBase = AdIdentity &
  AdExpiry & {
    provenance: AdInventoryProvenance;
    responseInfo: ResponseInfo | null;
    destroy(): void; // on the native arm this destroys the inner `ad` too
  };

type PooledAd =
  | (PooledAdBase & { format: AdFormat.NATIVE; ad: NativeAd })
  | (PooledAdBase & { format: AdFormat.BANNER; size: { width: number; height: number } })
  | (PooledAdBase & {
      format:
        | AdFormat.INTERSTITIAL
        | AdFormat.REWARDED
        | AdFormat.REWARDED_INTERSTITIAL
        | AdFormat.APP_OPEN;
      show(options?: AdShowOptions): Promise<void>;
      // Same generics as MobileAd / GAMInterstitialAd (GAM pools use adServer: 'ad-manager')
      addAdEventListener<T extends AdEventType | RewardedAdEventType | GAMAdEventType>(
        type: T,
        listener: AdEventListener<T>,
      ): () => void;
      addAdEventsListener<T extends AdEventType | RewardedAdEventType | GAMAdEventType>(
        listener: AdEventsListener<T>,
      ): () => void;
      removeAllListeners(): void;
    });

// poll() outcome. Replaces a bare `null`, which could not tell an exhausted
// buffer from a timeout, a no-fill, or a transport failure.
type PollResult =
  | { status: 'filled'; ad: PooledAd } // ownership transfers; not a freshness guarantee
  | { status: 'empty' } // buffer exhausted, refill in flight, not an error
  | { status: 'timeout' } // pollTimeoutMillis elapsed, not an error
  | { status: 'no-fill'; error: AdErrorPayload } // routine ad-server outcome
  | { status: 'error'; error: AdErrorPayload }; // network or internal failure

// Buffer readiness. `observedCount` is always present: both classic platforms
// expose a count for SDK-managed preloaders (`getNumAdsAvailable` /
// `numberOfAdsAvailableWithPreloadID:`), and library-managed pools know their
// own buffer depth. Both fields are upper bounds (no expiry sweep on Android
// V2; iOS sweep UNKNOWN).
type AdPoolAvailability = {
  available: boolean; // observedCount > 0
  observedCount: number;
};

interface AdPool {
  readonly poolId: string;
  readonly formats: AdFormat[];
  readonly resolved: AdPoolResolvedConfig;
  getAvailability(): Promise<AdPoolAvailability>;
  // Capability-gated (`poolResponseInfoPeek`). Unsupported → rejects with
  // 'pool/peek-unsupported'. Supported null = empty head (not unsupported).
  peekResponseInfo(): Promise<ResponseInfo | null>;
  poll(): Promise<PollResult>; // async; no put-back; never rejects; no freshness filter
  addListener(listener: (event: AdPoolEvent) => void): () => void;
  destroy(): void; // held-ad policy timer unaffected; native teardown of polled ads unverified
}

const AdPools: {
  getCapabilities(): AdCapabilities;
  create(config: AdPoolConfig): Promise<AdPool>;
  get(poolId: string): AdPool | null;
  destroyAll(): void;
};
```

**Stub:** `create()` rejects with `"AdPools.create is not implemented"`; `get()` returns `null`; `destroyAll()` is a no-op.

`resolved` is the post-create config after buffer / capability adjustments. When `degraded` is true, `degradeReasons` lists why (for example buffer clamped, request count clamped, or emulated preload without an SDK preloader).

**Why `create()` and `poll()` are asynchronous.** `create()` cannot report `resolved` until native answers: clamping `effectiveBufferSize` depends on app-wide pool accounting, and validation consults live backend capabilities. `poll()` crosses to native, and the Google Mobile Ads SDK delivers load callbacks on the main thread, so a synchronous version originating on the UI thread would deadlock. Capability reads stay synchronous because they are constants; anything that allocates native ad state or consults live pool accounting is asynchronous.

**`AdPoolEvent` shapes:**

```ts
type AdPoolEvent =
  | {
      type: 'degraded';
      poolId: string;
      reasons: AdPoolDegradeReason[];
      resolved: AdPoolResolvedConfig;
    }
  | { type: 'error'; poolId: string; error: AdErrorPayload }
  // Library-managed pools only: per-ad eviction. Never a polled ad.
  | {
      type: 'expired';
      poolId: string;
      adId: string;
      reason: 'stale-by-policy' | 'refresh';
      provenance: 'pool/emulated-no-sdk-preloader';
    }
  // Library-managed only: replacedAdId correlates with the preceding expired event.
  | {
      type: 'refreshed';
      poolId: string;
      adId: string;
      replacedAdId: string | null;
      provenance: 'pool/emulated-no-sdk-preloader';
    }
  // SDK-managed: buffer became empty; cause unknown (onAdsExhausted / adsExhausted).
  | { type: 'exhausted'; poolId: string }
  // SDK-managed: per-response-id availability (refresh observability with exhausted).
  | { type: 'available'; poolId: string; responseId: string };
```

On a pool the library manages itself, an eviction and its replacement are correlated by id: the `expired` event carries the outgoing `adId`, and the following `refreshed` event carries `replacedAdId` equal to that same id plus the incoming `adId`. A diagnostic consumer can build the full chain (evicted, why, what replaced it) from those two events alone. Library-managed pools do **not** unprompted forever-refill on policy eviction: replacement is demand-gated (refill after poll / consumer demand), because an unprompted forever-refill produces unshown fills that depress match rate. On a pool the platform preloader manages, that chain is not available; listen for `exhausted` and `available` instead. There is no separate "stopped refilling" event: observe an empty, non-refilling buffer as `exhausted` with no later `available`, together with `getAvailability().observedCount === 0`. See [Expiry: two different scopes](#expiry-two-different-scopes) and [Availability](#availability-getavailability).

<a id="availability-getavailability"></a>

### Availability (`getAvailability`)

`AdPool.getAvailability()` returns `{ available, observedCount }`. The count is **required**, not optional:

- **SDK-managed pools:** both classic platforms expose it (Android `getNumAdsAvailable(preloadId)` and iOS `numberOfAdsAvailableWithPreloadID:`).
- **Library-managed (emulated) pools:** the library reports its own buffer depth.

`available` is `observedCount > 0`. Neither field sweeps for expiry on the Android V2 path, so both are **upper bounds** (an ad past the platform TTL can still be counted until the next sweep). Whether iOS sweeps is UNKNOWN. Prefer this snapshot (or the hook's live `available` / `observedCount`) over assuming a retained depth equal to `bufferSize`: the SDK may optimize cache order, and the app-wide cap is server-delivered (`maxManagedPoolAds` reports `null`).

The hook mirrors the same numbers on every `usePooledAd` result arm as event-driven fields (updated from pool events and after each poll settles; no timer, no polling loop).

### Expiry: two different scopes

> **Single source of truth.** Everything about expiry, staleness, ad age, cache timeouts and eviction
> is governed by the canonical inventory expiry record published on the internal tracker as
> `inventory-expiry-canonical.md`. Where this reference and that record disagree, that record is
> correct and this reference is the defect. Freshness is a **policy the publisher sets**, not a
> condition the library observes: `expiresAt` / `isExpired()` / `onExpired()` are gone; the
> replacement is `stalenessWindowMillis` + `isStaleByPolicy()` / `onStaleByPolicy()`, with a
> provenance tag on every handed-out object.

**Everything this document says about age is said here, once.** Other sections link here rather than
restate it.

Two scopes, named apart:

| Question                                               | Answer                                                                                          |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| Did an ad **still in the pool** churn?                 | Library-managed: `expired` / `refreshed` by `adId`. SDK-managed: `exhausted` / `available` only |
| Did the ad or handle **I am holding** age?             | `isStaleByPolicy()` / `onStaleByPolicy()` on that `PooledAd` or handle                          |
| Am I at risk of rendering something stale from a hook? | The hooks reduce that risk; they do not remove it. See point 5 below                            |

A polled ad has left the pool, because ownership transfers on `poll()`, so pool events can never identify it. That is why the check lives on the handle too. The staleness timer lives on the held ad, not on the pool: it keeps running after `release()` and after pool `destroy()`. Whether a pool's `destroy()` also tears down the native resources of an ad it already handed out is **unverified** (open probe); do not build on either answer; destroy held ads explicitly when you are done.

**The canonical pattern is to poll at show time.** Google's own guidance is to leave ads in the SDK cache until you are ready to show, so the SDK can refresh and reorder them. That is the strongest surviving part of this contract.

#### What the library can and cannot tell you about age

1. **`poll()` carries no freshness guarantee.** The platform poll path performs no age sweep, so an ad can already be past the timeout the platform itself enforces at the moment it is handed over, and the library has no way to see that. A `filled` result therefore means "an ad came out of the buffer", nothing more. Ads that already exceed the configured policy window are **reported and handed over**, not discarded. `getAvailability()` and its `observedCount` are upper bounds for the same reason.
2. **Provenance decides what a time value means.** For a load this library performed (`'pool/emulated-no-sdk-preloader'`), `observedAt` is the library's own load completion. For an ad the platform polled out of its own buffer (`'pool/sdk-managed-preloader'`), `observedAt` is when the library first saw that response id become available, or `null` if it never did. Neither is the age the platform is accounting for.
3. **Freshness is a policy you set, and it protects in one direction only.** Configure `stalenessWindowMillis` per pool or per request, or inherit the defaults from `AdStalenessGuidanceMillis` (four hours for app open via `APP_OPEN`, one hour otherwise via `OTHER`). Those figures are Google's published guidance used as publisher policy defaults, not values this library or the platform enforces; the Android interstitial one hour figure is contested between sources. The window guards against you or the library holding an ad too long. It does **not** certify that an ad inside the window is valid. Applied window and source are readable on every handed-out object.
4. **`onStaleByPolicy` edge semantics.** Subscribing when the held ad is already stale by policy invokes the listener synchronously once. When `observedAt` is `null`, `isStaleByPolicy()` is `false` and the subscription never fires (unknown age is not treated as stale). `destroy()` releases listeners; a later unsubscribe is a no-op. The timer lives on the held object, not on the pool or the hook, so it keeps running after `release()` and after pool `destroy()`.
5. **The hooks reduce accidental stale rendering, they do not remove it.** `usePooledAd` subscribes to the held ad's `onStaleByPolicy`. Unrendered inventory is destroyed, `ad` cleared, and `status` set to `'stale-by-policy'` on the next render after the policy edge. Already-rendered banner/native inventory is left in place (impression already counted). `useMultiFormatAd` does the same per handle; `status` becomes `'stale-by-policy'` once no showable handle remains, retaining prior load `errors`. That closes the window in which the library is holding an ad too long after hand-off, except the same tick in which the policy edge fires (and the race between a check and `show()` / render). It also cannot close the window that opened before hand-off on a pool the platform preloader manages, per point 1. Keep an `isStaleByPolicy()` guard immediately before show/render for that residual.
6. **Staleness is not an error.** `status: 'stale-by-policy'` never populates `error`, the same way `empty` and `timeout` do not. No platform reports a show failure for a stale ad, so representing staleness as an error would invent a failure that never occurs. Do not add an expiry reason to `KnownAdErrorReason`.
7. **Library-managed pool refill is demand-gated.** Policy eviction of pool-owned inventory does not trigger an unprompted forever-refill; the pool refills in response to consumer demand (for example after `poll()`), because unshown fills depress match rate. SDK-managed pools follow the platform preloader's own refill behavior.
8. **Poll order does not follow preload order.** The platform buffer is a priority queue ordered by a value-like key, not a queue in arrival order.
9. **Imperative callers own the check.** `AdPools.create` + `poll()`, or `MultiFormatAdRequest.load()`, hand you objects with no hook watching them, so the staleness check and `destroy()` are both yours. After `release()`, the same is true: the policy timer lives on the object. Pool `destroy()` does not cancel it.

---

## Presets (new)

```ts
type AdPoolPresetOverrides = Omit<Partial<AdPoolConfig>, 'formats' | 'adUnitId'>;

AdPoolPresets.fullscreen(
  format: FullscreenAdFormat,
  adUnitId: string,
  options?: AdPoolPresetOverrides,
): AdPoolConfig; // poolId defaults to `fullscreen-${format}-${adUnitId}`

AdPoolPresets.display(adUnitId: string, options?: AdPoolPresetOverrides): AdPoolConfig;
// poolId defaults to `display-${adUnitId}`

MultiFormatAdPresets.nativeOrBanner(
  bannerSizes: MultiFormatBannerSize[],
): MultiFormatAdRequestOptions;
```

Presets return plain configuration objects. `AdPools.create` validates them like hand-written configs. The current `MultiFormatAdRequest.create` stub stores either form without validation; the wired implementation is intended to validate both consistently.

`AdPoolPresets.fullscreen` accepts rewarded interstitial in the type for cross-platform presets, but create hard-errors on Android classic when that format's preload capability is `unavailable`. Check `fullscreenPreloadFormats` first, or catch `'pool/format-preload-unsupported'`.

Both pool presets take the same `AdPoolPresetOverrides` bag, spread over the preset defaults. That bag deliberately omits `formats` and `adUnitId`: those come from the positional parameters, so `display()` cannot be handed `formats: [INTERSTITIAL]` or a different unit at the type level. Fullscreen is the only family where `bufferSize` above 1 is meaningful. Preset default depth is `1` (create under a tight app-wide cap); Google recommends `2` per preload ID. See [Buffer depth greater than 1](#buffer-depth-greater-than-1-a-fullscreen-capability) for the opt-in call and resolved fields.

Other override examples:

```ts
AdPoolPresets.fullscreen(AdFormat.INTERSTITIAL, unit, { requestOptions: { keywords: ['games'] } });
AdPoolPresets.fullscreen(AdFormat.APP_OPEN, unit, { stalenessWindowMillis: 2 * 60 * 60 * 1000 });
```

The computed `poolId` default (`fullscreen-${format}-${adUnitId}`, `display-${adUnitId}`) survives unless you override it. Prefer reading `config.poolId` at the consumer rather than hand-retyping the template: the preset return type carries the template literal, so a typo fails at compile time. The same convention is used in the [provider examples](#2-provider--display-pool-poll-and-show-a-banner).

---

## Hooks / provider (new)

```ts
type AdPoolProviderProps = {
  pools: AdPoolConfig[];
  children: React.ReactNode;
};

function AdPoolProvider(props: AdPoolProviderProps): React.ReactElement;

// `retry` sits on a shared base so it is callable without narrowing first.
// UseAdPoolResultBase is module-local; consumers import UseAdPoolResult.
type UseAdPoolResultBase = {
  retry: () => void; // re-attempt AdPools.create for this poolId
};

// Discriminated on status: `pool` narrows to non-null without assertions.
// `absent` means no pool is registered for this poolId, a common
// misconfiguration that would otherwise look like a create that never finishes.
type UseAdPoolResult = UseAdPoolResultBase &
  (
    | { status: 'creating'; pool: null; error: null }
    | { status: 'ready'; pool: AdPool; error: null }
    | { status: 'ready-degraded'; pool: AdPool; error: null }
    | { status: 'error'; pool: null; error: AdError }
    | { status: 'absent'; pool: null; error: null }
  );

type UseAdPoolStatus = UseAdPoolResult['status'];

function useAdPool(poolId: string): UseAdPoolResult;

// Discriminated on `status`, like `PollResult` / `UseAdPoolResult`.
// `{ status: 'filled', ad: null }` and `{ status: 'error', error: null }`
// do not type-check. Terminal arms mirror `PollResult`; `idle`, `polling`,
// `stale-by-policy`, and `consumed` are hook-only. `stale-by-policy` and
// `consumed` are not errors: `error` stays null, like `empty` and `timeout`.
// UsePooledAdResultBase is module-local; consumers import UsePooledAdResult
// and UsePooledAdStatus.
type UsePooledAdResultBase = {
  // Same vocabulary as useAdPool; distinguishes absent / creating / ready
  // without pairing a second hook; useAdPool still needed for pool / retry.
  poolStatus: UseAdPoolStatus;
  available: boolean; // observedCount > 0; event-driven upper bound
  observedCount: number; // always present; upper bound (no Android V2 expiry sweep)
  poll: () => Promise<PollResult>; // updates state; never rejects; never during render
  // take ownership without destroying; leaves status 'idle' among current arms
  release: () => PooledAd | null;
};

type UsePooledAdResult = UsePooledAdResultBase &
  (
    | { status: 'idle'; ad: null; error: null }
    | { status: 'polling'; ad: PooledAd | null; error: null } // prior ad may still be held
    | { status: 'filled'; ad: PooledAd; error: null }
    | { status: 'empty'; ad: null; error: null }
    | { status: 'timeout'; ad: null; error: null }
    | { status: 'no-fill'; ad: null; error: AdError }
    | { status: 'error'; ad: null; error: AdError }
    | { status: 'stale-by-policy'; ad: PooledAd | null; error: null } // rendered ad may remain
    // consumed milestone: await show() fulfills (not OPENED/CLOSED/EARNED_REWARD)
    | { status: 'consumed'; ad: null; error: null }
  );

type UsePooledAdStatus = UsePooledAdResult['status'];

function usePooledAd(poolId: string): UsePooledAdResult;

// Discriminated on `status`. Terminal arms mirror `MultiFormatLoadResult`.
// `loaded-partial` is real: one request can return a usable handle and load-time
// errors together. The SDK does not attribute those errors to a specific format,
// so the `loaded-partial` branch carries both `ads` and `errors` rather than
// forcing `loaded` vs `error`. `no-fill` is split from `error` so
// a clean no-fill does not look like a failure with an empty `errors` array.
// `stale-by-policy` is not an error; prior load errors are retained.
// UseMultiFormatAdResultBase is module-local; consumers import
// UseMultiFormatAdResult and UseMultiFormatAdStatus.
type UseMultiFormatAdResultBase = {
  autoLoad: boolean; // resolved policy, so a permanent 'idle' is diagnosable
  responseInfo: ResponseInfo | null; // present on every arm, including 'no-fill'
  // updates state; never rejects; coalesces like usePooledAd().poll()
  load: () => Promise<MultiFormatLoadResult>;
  retry: () => void; // fire-and-forget load(), for a retry button
  // take ownership without destroying; leaves status 'idle' among current arms
  release: () => MultiFormatAdHandle[];
};

type UseMultiFormatAdResult = UseMultiFormatAdResultBase &
  (
    | { status: 'idle'; ads: never[]; errors: never[] }
    | { status: 'loading'; ads: MultiFormatAdHandle[]; errors: AdError[] }
    | { status: 'loaded'; ads: MultiFormatAdHandle[]; errors: never[] }
    | { status: 'loaded-partial'; ads: MultiFormatAdHandle[]; errors: AdError[] }
    | { status: 'no-fill'; ads: never[]; errors: never[] }
    | { status: 'error'; ads: never[]; errors: AdError[] }
    | { status: 'stale-by-policy'; ads: MultiFormatAdHandle[]; errors: AdError[] }
  );

type UseMultiFormatAdStatus = UseMultiFormatAdResult['status'];

// One options object: the imperative config plus the automatic-load policy, so the hook and
// `MultiFormatAdRequest.create` accept the same request description.
type UseMultiFormatAdOptions = MultiFormatAdConfig & {
  autoLoad?: boolean; // default true; controls automatic loading
};

function useMultiFormatAd(options: UseMultiFormatAdOptions): UseMultiFormatAdResult;
```

### What the types cannot check

Two guarantees above are expressible in TypeScript and are expressed: discriminated hook/pool results (narrowing `pool` / `ad` / `error`), and the banner-only `handle` prop on `MultiFormatBannerAdView`. The rest of the lifecycle contract is **runtime behavior**, not a type:

- `poll()` / `load()` never reject (outcomes are result unions)
- concurrent `poll()` / `load()` coalesce per hook instance
- the hook owns inventory and destroys it on unmount, supersede, and unrendered `stale-by-policy`
- `release()` immediately after `await poll()` / `await load()` returns that inventory (implementation ref)
- returned `poll` / `load` / `release` / `retry` keep identity for the life of the hook instance
- `AdPoolProvider` reconciles by `poolId`, not by `pools` array identity

Trust those as documented behavior. TypeScript will not catch a violation.

### Hook state ownership

`usePooledAd` is **state-first**. Calling `poll()` updates `status`, `ad`, and `error` on the hook, so you do not track loading, stash the ad, or destroy it yourself. It also:

- **coalesces** concurrent calls onto the in-flight poll, so a double tap (or React StrictMode in development double-invoking an effect that calls `poll()`) cannot burn two ads (**per hook instance**; see shared-`poolId` note below),
- **destroys** the previous ad when a later poll supersedes it, and every held ad on unmount,
- **subscribes** to `onStaleByPolicy`: unrendered inventory is destroyed, `ad` cleared, and `status` set to `'stale-by-policy'`; already-rendered banner/native inventory is left in place,
- **consumes** a fullscreen ad it still owns when `await ad.show()` **fulfills** (show-promise settle): destroys the spent ad, clears `ad`, and sets `status` to `'consumed'` (not an error; a later show attempt on a released reference fails with reason `'ad-already-used'`). The milestone is **not** `OPENED`, `CLOSED`, or `EARNED_REWARD`: native show promises resolve after `present`/`show` without waiting for those events (Android `FullScreenAdModule`, iOS `RNGoogleMobileAdsFullScreenAd`; classic `useFullScreenAd` tracks `OPENED`/`CLOSED` for observation only and does not auto-destroy),
- **never rejects**: `poll()` resolves into the same `PollResult` the state reflects, so the return value is optional convenience for “poll and show in one handler”.

**Do not call `destroy()` on inventory the hook still owns.** That leaves the hook able to report `filled` / `loaded` with a dead ad (the same ownership rule as the inner `NativeAd` on a native arm). Early `destroy()` while hook-owned also drops listeners, so post-show events cannot be observed. Call `release()` first if you need to own destruction or post-show observation (handing the ad to a store, wiring your own `CLOSED` listener, etc.), or leave destruction to the hook.

Use `release()` when the ad must outlive the hook, or when you need post-show events on a fullscreen ad. It clears hook state to `status: 'idle'` (among the current arms) so unmount cleanup will not destroy an ad someone else now owns. After `release()`, the caller owns both `destroy()` and the staleness check: the policy timer lives on the ad and is unaffected by pool `destroy()`. Ordering is guaranteed: `release()` called immediately after `await poll()` returns the ad that poll just produced, without waiting for a render, because the hook tracks the current ad in a ref alongside state.

`available` and `observedCount` are **event-driven**: updated from the pool's own events and after each poll settles. There is no timer and no polling loop. Both are upper bounds (see [Availability](#availability-getavailability)). `available` is `observedCount > 0`.

`poolStatus` carries the same lookup vocabulary as `useAdPool` (`absent` / `creating` / `ready` / `ready-degraded` / `error`), so `status: 'idle'` with `available: false` no longer conflates an absent pool, a warming pool, and a ready empty buffer. Call `useAdPool` when you still need the `AdPool` object, `retry()`, or `resolved.degradeReasons`. Example 2 below uses both.

**Shared `poolId`:** coalescing is per hook instance. Two components that both call `usePooledAd(sameId)` each coalesce only their own concurrent `poll()` calls; they do **not** share an in-flight poll. On a depth-1 display pool one placement reliably starves the other. Give each placement its own pool, or make a single owner poll and pass the ad down.

### Why there are three status vocabularies

**Each hook's status words mirror the surface that hook observes.** That is the whole rule, and it is why the words differ rather than being unified into one union:

| Hook                     | Mirrors                  | In-flight / success words             |
| ------------------------ | ------------------------ | ------------------------------------- |
| `usePooledAd`            | `PollResult`             | `polling` / `filled`                  |
| `useMultiFormatAd`       | `MultiFormatLoadResult`  | `loading` / `loaded` / `loaded-partial` |
| The four fullscreen hooks | the `AdEventType` lifecycle | `loading` / `loaded` / `showing` / `closed` |

Shared words (`idle`, `no-fill`, `error`, and `stale-by-policy` where it applies) mean the same thing everywhere. In-flight and success words do not, and must not be treated as synonyms.

Two of those are worth stating outright:

- **`'closed'` is not `'consumed'`.** A fullscreen hook's `'closed'` is the dismissal of a shown ad, observed from `AdEventType.CLOSED`, and it destroys nothing. `usePooledAd`'s `'consumed'` fires when the show promise fulfills and the hook destroys the spent ad. Different milestone, different ownership consequence.
- **`'consumed'` exists only on pooled fullscreen ads.** Multi-format handles are banner or native and have no `show()`.

A unified union was rejected because it would have to be the union of every surface's words, which puts `filled` on a hook that never polls and `showing` on a hook whose handles cannot be shown. Narrow unions that mirror one surface each are what make an exhaustive `switch` meaningful.

`useMultiFormatAd` remains the sibling of `usePooledAd` for **ownership and lifecycle**: same never-reject load, same coalescing, same `release()` ordering, same staleness handling.

Sibling guarantees that do match:

- the hook **owns** the handles it returns,
- it **destroys** them on unmount, and when a later `load()` supersedes them,
- it **subscribes** per handle to `onStaleByPolicy`, drops a stale unrendered handle from `ads`, and reports `status: 'stale-by-policy'` once no showable handle remains, retaining prior load `errors`,
- `load()` **coalesces** concurrent calls onto the in-flight load (**per hook instance**), same parity as `poll()`, including under StrictMode double-invoke of the mount effect,
- `load()` **never rejects**: it resolves a `MultiFormatLoadResult` mirroring the state it just set,
- `release()` hands the current handles to the caller and clears hook state to `status: 'idle'` (among the current arms), returning `[]` when nothing is held, with the same post-`await` ordering guarantee,
- callers **must not** `destroy()` handles the hook still owns; `release()` first.

### Callback identity and argument freshness

**Returned callbacks keep the same identity for the life of the hook instance.** `poll`, `load`, `release`, and `retry` are stable references; fullscreen `show` and `destroy` are stable too. Listing them in a dependency array does not re-run the effect. That is what makes an effect like `useEffect(() => { if (status === 'closed') load(); }, [status, load])` fire on the transition rather than on every render.

**Hook arguments are not frozen into those callbacks.** `poolId`, `adUnitId`, and `options` are sampled when the callback runs (the implementation holds them or the latest created instance in refs updated each render). Passing a fresh inline options object every render (including `MultiFormatAdPresets.nativeOrBanner(...)` called in the render body) does **not** change `load`'s identity and does **not** re-fire an effect that depends only on `[load]`. The next callback invocation uses the latest applicable arguments or ad instance.

If you need to reload when options change, depend on those options (or a value derived from them) yourself and call `load()`; do not expect `[load]` alone to detect argument changes.

**Coalescing and StrictMode.** Both `poll()` and `load()` coalesce concurrent calls onto one in-flight promise per hook instance. Joiners share the result started with the arguments current when the flight began; after it settles, the next call samples current arguments. React StrictMode in development double-invokes effects: without coalescing, the documented mount-effect pattern would issue two polls or two loads. Coalescing is still per hook instance: two components sharing one `poolId` do not share an in-flight poll (see shared-`poolId` note above).

`useAdPool` exposes `status` rather than `ready` + `degraded` booleans, and does **not** mirror degrade reasons; read `pool.resolved.degradeReasons`, the single source of truth.

`useAdPool().retry()` exists because pool creation is provider-owned: without it `status: 'error'` would be terminal, even though the underlying ad load may have failed transiently. It re-attempts `AdPools.create` for that `poolId` using the config the provider already holds, moving the state back through `creating`. It is a no-op while a create is already in flight, and a no-op when `status` is `absent`, where there is no config to retry with and the fix is the provider config. It lives on a shared base of the union, so it is callable without narrowing.

### How the provider connects to later usage

`AdPoolProvider` does **not** inject ads into the tree by itself. It only **owns** pools for its lifetime:

1. You pass configs (usually from `AdPoolPresets.*`). Each config has a stable `poolId` (see [Presets](#presets-new)).
2. On mount (when wired), the provider calls `AdPools.create` for each config and keeps those native pools alive.
3. Descendants look pools up **by that same `poolId`** via `useAdPool(poolId)` / `usePooledAd(poolId)`.
4. You still **poll** when you want inventory, then **render or `show()`** the returned `PooledAd`. The provider never auto-shows.

**The provider reconciles by `poolId`, not by array identity.** On every render it creates pools for ids that have appeared, destroys pools for ids that have disappeared, and leaves existing pools untouched when only the array identity changed. A forgotten `useMemo` therefore cannot tear down and recreate native pools every render: `useMemo` is an optimization here, never a correctness requirement. Reusing a `poolId` with a different config replaces that pool, because the id is the identity.

```
AdPoolProvider(pools=[…configs with poolId…])
        │
        │  creates / destroys AdPool instances
        ▼
useAdPool(poolId) / usePooledAd(poolId)   ← same poolId string
        │
        │  poll() → PollResult ('filled' carries the PooledAd)
        ▼
show()  or  <MultiFormatBannerAdView> / <NativeAdView>
```

If you never wrap with `AdPoolProvider`, you can still:

- use today’s shims (`InterstitialAd`, `<BannerAd>`, `NativeAd`, existing hooks) with **no** pool, or
- call `AdPools.create` / `AdPools.get` imperatively and poll yourself.

**Rules:** never `poll()` during render; pool ownership stays with the provider or `AdPools.create`, never with the consumer hook. `usePooledAd` and `useMultiFormatAd` destroy the inventory they hand you on unmount, so call `release()` if it must outlive the hook, and before you call `destroy()` yourself. Imperative callers of `AdPools.create` / `MultiFormatAdRequest.load` own `destroy()` and the age check themselves: see [Expiry: two different scopes](#expiry-two-different-scopes).

**Stub:** provider is a pass-through; `useAdPool` reports `absent` with a no-op `retry`; `usePooledAd` reports `idle` and its `poll()` resolves `{ status: 'empty' }`; `useMultiFormatAd` reports `idle` and its `load()` resolves `{ status: 'no-fill', ads: [], errors: [], responseInfo: null }`. Only the imperative `MultiFormatAdRequest.load()` still rejects.

---

## Metadata (additive)

```ts
type AdapterResponseError = {
  domain: string;
  code: number;
  message: string;
};

// Fields every waterfall row reports, pass or fail. Latency on failed rows is
// what makes waterfall debugging useful, so these never disappear.
type AdapterResponseInfoBase = {
  adapterClassName: string;
  adSourceName: string | null;
  adSourceId: string | null;
  adSourceInstanceName: string | null;
  adSourceInstanceId: string | null;
  latencyMillis: number;
};

// `outcome` narrows adError without pretending the shared fields vanish on error.
type AdapterResponseInfo = AdapterResponseInfoBase &
  ({ outcome: 'success'; adError: null } | { outcome: 'error'; adError: AdapterResponseError });

// The winning row cannot carry an error, so adError is statically null.
type LoadedAdapterResponseInfo = AdapterResponseInfoBase & {
  outcome: 'success';
  adError: null;
};

type ResponseInfoExtras = {
  mediationGroupName?: string;
  mediationAbTestName?: string;
  mediationAbTestVariant?: string;
  creativeId?: string;
  lineItemId?: string;
};

type ResponseInfo = {
  responseId: string | null;
  adapterClassName: string | null;
  loadedAdapterResponse: LoadedAdapterResponseInfo | null; // null when nothing loaded
  adapterResponses: AdapterResponseInfo[];
  extras: ResponseInfoExtras;
};

/** Paid-event snapshot: omits the full `adapterResponses` list. */
type PaidResponseInfo = Pick<
  ResponseInfo,
  'responseId' | 'adapterClassName' | 'loadedAdapterResponse' | 'extras'
>;

type PaidEvent = {
  currency: string;
  precision: RevenuePrecisions;
  value: number;
  responseInfo?: PaidResponseInfo;
  valueMicros?: string | null; // decimal string; null when not exact
};
```

No eCPM or lift claims in the public API.

---

## Error payload (additive)

```ts
type KnownAdErrorReason =
  | 'no-fill'
  | 'mediation-no-fill'
  | 'network-error'
  | 'timeout'
  | 'invalid-request'
  | 'invalid-argument'
  | 'invalid-ad-string'
  | 'app-id-missing'
  | 'internal-error'
  | 'server-error'
  | 'mediation-adapter-error'
  | 'mediation-data-error'
  | 'mediation-invalid-ad-size'
  | 'ad-already-used'
  | 'request-id-mismatch'
  | 'pool/format-preload-unsupported' // create: format the platform preloader rejects
  | 'pool/peek-unsupported' // peekResponseInfo where poolResponseInfoPeek is unavailable
  | 'unknown';

type AdErrorReason = KnownAdErrorReason | (string & {});

type AdErrorPayload = {
  /** @deprecated Use `reason`. Removed in v18 with the shims. */
  code: string;
  message: string;
  reason: AdErrorReason;
  phase: 'load' | 'show';
  responseInfo?: ResponseInfo;
};

// The one error type every v17 hook and multi-format load result uses.
type AdError = NativeError & AdErrorPayload;
```

Legacy `code` / `message` values stay unchanged. Fail-to-show uses `ERROR` with `phase: 'show'` (no separate show-failed event).

`AdError` is a real `Error` (it can be thrown, and it has a `stack`) that also carries the structured payload, so `reason` / `phase` / `responseInfo` branching works identically whether the error arrived through a hook or through an `AdEventType.ERROR` event, whose payload is `Error & AdErrorPayload`. One shape for those delivery styles. Banner / GAM `onAdFailedToLoad` stays `Error & Partial<AdErrorPayload>` (see [Error handling](#6-error-handling-reason--phase)).

`NativeError` itself is deliberately unchanged: it is shared with legacy code paths that have no structured payload to supply. `AdError` is the intersection, used by `useAdPool().error`, `usePooledAd().error`, `useMultiFormatAd().errors`, `MultiFormatLoadResult.errors`, and `MultiFormatAdRequest.load()`. Pool-level shapes (`PollResult`, `AdPoolEvent`) carry the plain `AdErrorPayload`, because those are data records crossing from native rather than objects a consumer would throw.

### Errors versus response records

Three channels, and each one answers a different question. Keeping them apart is what lets a routine no-fill stay routine while still supporting investigation.

| Channel              | Question it answers                    |
| -------------------- | -------------------------------------- |
| `status`             | What happened?                         |
| `error` / `errors`   | What failed, if anything?              |
| `responseInfo`       | What did the ad server send back?      |

Two consequences follow, and they explain a difference between the hooks that otherwise looks like an inconsistency.

**Singular `error` carries the payload of one outcome.** On the single-ad paths (`PollResult`, `usePooledAd`, the fullscreen hooks) a no-fill is one response, and the platform delivers one error payload for it with `reason: 'no-fill'`. So `error` is populated on `'no-fill'`, and `status` rather than `error !== null` is what tells you whether anything actually failed.

**Plural `errors` lists what failed.** On the multi-format path a clean no-fill had no per-format failure, so `errors` is `never[]`. Populating it would assert failures that did not occur, which is exactly what splitting `no-fill` out of `error` was meant to prevent.

**That is why `responseInfo` sits at the top level of the multi-format results.** A load that can report zero or many failures has no single error payload to hang the response record on, so the record gets its own field, present on every arm including `'no-fill'`. The single-ad paths reach the same record through `error.responseInfo`. Either way the `responseId` for an ad-serving investigation is reachable on every outcome that produced a response.

---

## Config defaults and `adServer` asymmetry

Optional fields on `AdPoolConfig` mean the following when omitted:

| Field | When omitted |
| ----- | ------------ |
| `bufferSize` | Presets supply `1`. A hand-written config that omits it has **no documented numeric default** until native `AdPools.create` lands; do not assume depth. |
| `pollTimeoutMillis` | No timeout is configured. `PollResult` / hook `'timeout'` is only reachable when you set a positive timeout (otherwise that switch arm is dead). |
| `stalenessWindowMillis` | Pool applies Google's published guidance (four hours app open, one hour otherwise) and records the source on handed-out ads. See [Expiry](#expiry-two-different-scopes). |
| `adServer` | Unspecified; classic AdMob vs GAM selection follows how you build the request when wired. |
| `mediation` | Unspecified (`unknown` is the capability stub's mediation reading, not an implicit pool config default). |

**`adServer` domain asymmetry (intentional):** `AdPoolConfig.adServer` is `'ad-manager' | 'admob'`. `MultiFormatAdRequestOptions.adServer` is `'ad-manager'` only, because multi-format banner sizes are the GAM / AdLoader-style path. Same field name, different domain.

---

## Usage examples

> Illustrative “when native lands” code. Today these APIs stub/reject as noted above;
> shapes and ownership rules are what freeze.

### 1. No pool: today’s shims still work

Pools and multi-format requests are **opt-in**. Existing apps keep working:

```tsx
import React, { useEffect } from 'react';
import { Button, View } from 'react-native';
import {
  BannerAd,
  BannerAdSize,
  InterstitialAd,
  AdEventType,
  TestIds,
} from 'react-native-google-mobile-ads';

const interstitial = InterstitialAd.createForAdRequest(TestIds.INTERSTITIAL);

export function ClassicScreen() {
  useEffect(() => {
    const unsub = interstitial.addAdEventListener(AdEventType.LOADED, () => {
      interstitial.show();
    });
    interstitial.load();
    return unsub;
  }, []);

  return (
    <View>
      <BannerAd unitId={TestIds.BANNER} size={BannerAdSize.LARGE_ANCHORED_ADAPTIVE_BANNER} />
      <Button title="Reload interstitial" onPress={() => interstitial.load()} />
    </View>
  );
}
```

Same story for `useInterstitialAd` / `NativeAd.createForAdRequest`: no `AdPoolProvider` required.

#### Fullscreen hook, options form

The same hook, opted into the v17 shape. There is no mount effect, no loading boolean, and no ad to stash: reaching for `status` covers all of it.

```tsx
import React from 'react';
import { Button, Text, View } from 'react-native';
import { TestIds, useInterstitialAd } from 'react-native-google-mobile-ads';

export function LevelEndButton({ consentReady }: { consentReady: boolean }) {
  const { status, error, show, retry } = useInterstitialAd({
    adUnitId: TestIds.INTERSTITIAL,
    // Loads as soon as this turns true. Nothing loads before it does.
    autoLoad: consentReady,
  });

  // A no-fill is routine, so it is its own status rather than a failure.
  if (status === 'no-fill') {
    return <Text onPress={retry}>Nothing to show. Tap to try again.</Text>;
  }
  if (status === 'error') {
    return <Text onPress={retry}>Ad failed: {error.reason}. Tap to retry.</Text>;
  }

  return (
    <View>
      <Button
        title="Continue"
        disabled={status !== 'loaded'}
        onPress={() => show()}
      />
      {/* 'showing' and 'closed' describe this ad, not the next one. */}
      {status === 'closed' ? <Text>Thanks for watching.</Text> : null}
    </View>
  );
}
```

Note `error.reason` needs no null check on the `'error'` arm: `status` is the discriminant, so the payload is narrowed with it.

#### Reloading after dismissal

Automatic loading fires once per ad unit and never again on its own, so warming the next ad is an explicit choice. Watch the status you already have:

```tsx
function LevelEndAd() {
  const { status, show, load } = useInterstitialAd({ adUnitId: TestIds.INTERSTITIAL });

  // Warm the next ad only after the user dismisses this one. load() moves
  // status to 'loading', so this fires once per dismissal rather than looping.
  useEffect(() => {
    if (status === 'closed') load();
  }, [status, load]);

  return <Button title="Continue" disabled={status !== 'loaded'} onPress={() => show()} />;
}
```

There is deliberately no `reloadOnClose` option. Four lines is not a burden, and writing it out keeps the cost of a fill visible at the call site while leaving room for the condition apps actually want: reload only when another impression is plausible, gated on a level counter, screen focus, or a session cap. A flag would hide that cost and invite leaving it on everywhere.

---

### 2. Provider + display pool: poll and show a banner

Children must use the same `poolId` the provider registered: read it from the preset config (see [Presets](#presets-new)).

```tsx
import React, { useCallback, useMemo } from 'react';
import { Button, Text, View } from 'react-native';
import {
  AdFormat,
  AdPoolPresets,
  AdPoolProvider,
  BannerAdSize,
  MultiFormatBannerAdView,
  NativeAdView,
  NativeAsset,
  NativeAssetType,
  TestIds,
  useAdPool,
  usePooledAd,
} from 'react-native-google-mobile-ads';

const FEED_UNIT = TestIds.BANNER; // replace with your GAM display unit
const displayPool = AdPoolPresets.display(FEED_UNIT, {
  bannerSizes: [BannerAdSize.MEDIUM_RECTANGLE, BannerAdSize.BANNER],
  adServer: 'ad-manager',
});
const DISPLAY_POOL_ID = displayPool.poolId; // typed joint with the provider config

function FeedPlacement() {
  // poolStatus on usePooledAd distinguishes absent / creating / ready.
  // useAdPool still supplies pool, retry(), and degradeReasons.
  const poolState = useAdPool(DISPLAY_POOL_ID);
  // State-first: no loading flag, no ad stashing, no manual destroy.
  const { status, poolStatus, available, observedCount, poll, ad, error } =
    usePooledAd(DISPLAY_POOL_ID);

  const onShowNext = useCallback(() => {
    // Never call poll() during render, only from handlers or effects.
    // Concurrent calls coalesce per hook instance, so a double tap cannot
    // burn two ads. Do not mount two usePooledAd(sameId) owners on a
    // depth-1 pool: one starves the other.
    void poll();
  }, [poll]);

  // Prefer poolStatus from the consumer hook for absent/warming gates.
  switch (poolStatus) {
    case 'absent':
      return <Text>No pool registered for {DISPLAY_POOL_ID}. Check the provider config.</Text>;
    case 'creating':
      return <Text>Warming display pool…</Text>;
    case 'error':
      // retry() is on every useAdPool arm, so no narrowing is needed to call it.
      return (
        <Text onPress={poolState.retry}>
          Pool failed: {poolState.error?.reason}. Tap to retry.
        </Text>
      );
  }

  return (
    <View>
      {poolState.status === 'ready-degraded' ? (
        // Degrade reasons live on the pool, not mirrored onto usePooledAd.
        <Text>Pool degraded: {poolState.pool.resolved.degradeReasons.join(', ')}</Text>
      ) : null}
      <Text>
        Available: {available ? 'yes' : 'no'} (count {observedCount})
      </Text>
      {status === 'empty' ? <Text>Buffer empty, refilling.</Text> : null}
      {status === 'no-fill' ? <Text>No fill for this request.</Text> : null}
      {/* Not an error: the held ad crossed the policy window; the hook dropped unrendered inventory. */}
      {status === 'stale-by-policy' ? <Text>Ad stale by policy, poll again.</Text> : null}
      {error ? (
        <Text>
          Poll failed: {error.reason} ({error.phase})
        </Text>
      ) : null}
      <Button title="Poll next ad" onPress={onShowNext} disabled={status === 'polling'} />

      {/* The hook clears unrendered `ad` and reports 'stale-by-policy' when policy fires. */}
      {ad?.format === AdFormat.BANNER ? (
        // Pooled banner arm matches MultiFormatBannerAdHandle structurally.
        <MultiFormatBannerAdView handle={ad} />
      ) : null}

      {ad?.format === AdFormat.NATIVE ? (
        <NativeAdView nativeAd={ad.ad}>
          {/* NativeAsset wraps the element that renders the asset. */}
          <NativeAsset assetType={NativeAssetType.HEADLINE}>
            <Text>{ad.ad.headline}</Text>
          </NativeAsset>
          <NativeAsset assetType={NativeAssetType.BODY}>
            <Text>{ad.ad.body}</Text>
          </NativeAsset>
        </NativeAdView>
      ) : null}
    </View>
  );
}

export function AppWithDisplayPool() {
  // useMemo is an optimization, not a requirement: the provider reconciles by
  // poolId, so a new array identity does not recreate the pool.
  const pools = useMemo(() => [displayPool], []);

  return (
    <AdPoolProvider pools={pools}>
      <FeedPlacement />
    </AdPoolProvider>
  );
}
```

**Takeaway:** the provider registers the pool; `usePooledAd(DISPLAY_POOL_ID)` is how a screen later consumes it. Changing `poolId` in the child without matching the provider config looks up nothing.

#### What a loud degrade looks like

Ask a **display** pool for depth and it clamps to 1, because neither classic backend ships an SDK display preloader. The pool still works; it tells you what it did rather than failing or pretending:

```ts
import { AdPoolPresets, AdPools, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';

const FEED_UNIT = TestIds.BANNER;
const pool = await AdPools.create(
  AdPoolPresets.display(FEED_UNIT, {
    bannerSizes: [BannerAdSize.MEDIUM_RECTANGLE],
    bufferSize: 3, // not honourable on a display pool today
  }),
);

pool.resolved.requestedBufferSize; // 3
pool.resolved.effectiveBufferSize; // 1
pool.resolved.degraded; // true
pool.resolved.degradeReasons;
// ['pool/degraded-buffer-size', 'pool/emulated-no-sdk-preloader']
```

`useAdPool` surfaces the same thing as `status: 'ready-degraded'`. In `__DEV__`, the library also logs a one-time warning that the config leads to degraded mode. This is the difference between a **hard error** (the request is impossible: a format would be dropped, an illegal size, an unsupported mix) and a **loud degrade** (a milder adjustment was safe and is reported).

---

### 3. Provider + fullscreen pool: poll then `show()`

```tsx
import React, { useCallback, useMemo } from 'react';
import { Button } from 'react-native';
import {
  AdEventType,
  AdFormat,
  AdPoolPresets,
  AdPoolProvider,
  TestIds,
  usePooledAd,
} from 'react-native-google-mobile-ads';

const UNIT = TestIds.INTERSTITIAL;
const fullscreenPool = AdPoolPresets.fullscreen(AdFormat.INTERSTITIAL, UNIT);
const POOL_ID = fullscreenPool.poolId;

function LevelEndButton() {
  const { poll, release } = usePooledAd(POOL_ID);

  const onPress = useCallback(async () => {
    // Prefer a poll at show time. The hook already drops unrendered inventory
    // that crossed the policy window on the next render after the policy edge;
    // this guard covers the residual same-tick case and the race between check
    // and show (re-check immediately before show). See Expiry point 5.
    const result = await poll();
    if (result.status !== 'filled' || result.ad.format !== AdFormat.INTERSTITIAL) {
      return;
    }

    // Take ownership before show/destroy. While the hook owns the ad, do not
    // call destroy() (that would leave the hook reporting filled with a dead
    // ad). release() clears hook state so CLOSED cleanup is yours alone.
    const next = release();
    if (!next) return;
    if (next.isStaleByPolicy()) {
      next.destroy();
      return;
    }

    const unsub = next.addAdEventListener(AdEventType.CLOSED, () => {
      unsub();
      next.destroy();
      // Next impression: poll again in onPress (poll-at-show-time). Do not poll here:
      // poll() pulls into hook state; a later onPress poll supersedes it and burns a fill.
    });
    await next.show();
  }, [poll, release]);

  return <Button title="Continue (ad)" onPress={onPress} />;
}

export function AppWithFullscreenPool() {
  const pools = useMemo(() => [fullscreenPool], []);
  return (
    <AdPoolProvider pools={pools}>
      <LevelEndButton />
    </AdPoolProvider>
  );
}
```

There is **no** `useInterstitialAd`-style show hook for pools on purpose: a polled fullscreen `PooledAd` already exposes `show()` and the same event listeners.

If you keep the ad hook-owned instead of calling `release()`, `await ad.show()` and let the hook move to `status: 'consumed'` when that promise **fulfills** (it destroys the spent ad for you). Do not call `ad.destroy()` yourself in that path. **Footnote: two paths:**

- **Path A (`release()` then show):** Example 3 above. You own listeners through `CLOSED` / reward / paid, then `destroy()` yourself. Required whenever you need post-show observation.
- **Path B (hook-owned show):** `'consumed'` fires on show-promise settle, then the hook destroys. That drops listeners, so you will **not** see `OPENED` / `CLOSED` / `EARNED_REWARD` afterward. Early `destroy()` while still hook-owned has the same effect.

Rejected milestones for Path B: `OPENED` (native show promises do not wait for it), `CLOSED` / `EARNED_REWARD` (classic `useFullScreenAd` / `MobileAd` observation lifecycle, not the pool consume signal; waiting for them would keep the handle alive through the impression and contradict destroy-on-consume).

Holding a polled ad across a long session is the consumer's risk (the pool cannot refresh an ad it no longer owns). Rules: [Expiry: two different scopes](#expiry-two-different-scopes).

#### Buffer depth greater than 1: a fullscreen capability

Fullscreen formats have a real SDK preloader on both classic backends, so they can hold more than one ready ad. `AdPoolPresets.fullscreen` takes the override bag directly, so this is the one preset call where `bufferSize` is worth passing:

```ts
import { AdFormat, AdPoolPresets, AdPools, TestIds } from 'react-native-google-mobile-ads';

const UNIT = TestIds.INTERSTITIAL;
const pool = await AdPools.create(
  AdPoolPresets.fullscreen(AdFormat.INTERSTITIAL, UNIT, {
    bufferSize: 2, // the depth Google recommends per preload ID
  }),
);

pool.resolved.effectiveBufferSize; // 2 where the app-wide cap allows it
pool.resolved.degraded; // false
```

The cap is app-wide across every format and preload ID, and the SDK resolves it at runtime from server-delivered settings rather than from a fixed number, so `maxManagedPoolAds` reports `null` and `effectiveBufferSize` is the value to read. Shallow pools coexist comfortably; many deep pools will clamp.

Depth interacts with age rather than solving it: a deeper buffer means more ads aging at once, and it does not change what the library can observe. See [Expiry: two different scopes](#expiry-two-different-scopes).

---

### 4. Multi-format ad via hook (no pool)

`useMultiFormatAd` is independent of `AdPoolProvider`. One request, winner is native **or** banner (count 1).

```tsx
import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import {
  AdFormat,
  BannerAdSize,
  MultiFormatAdPresets,
  MultiFormatBannerAdView,
  NativeAdView,
  NativeAsset,
  NativeAssetType,
  TestIds,
  useMultiFormatAd,
} from 'react-native-google-mobile-ads';

const UNIT = TestIds.BANNER;

export function MultiFormatFeedSlot({ consentReady }: { consentReady: boolean }) {
  // No mount effect and no useCallback: the hook loads when `autoLoad` allows
  // it, and `retry` is the fire-and-forget load a retry button wants.
  const { status, ads, errors, retry } = useMultiFormatAd({
    adUnitId: UNIT,
    requestOptions: MultiFormatAdPresets.nativeOrBanner([
      BannerAdSize.MEDIUM_RECTANGLE,
      BannerAdSize.BANNER,
    ]),
    autoLoad: consentReady,
  });

  if (status === 'idle' || status === 'loading') return <ActivityIndicator />;
  // A clean no-fill is a routine ad-server outcome, so it is not `error` and
  // `errors` is empty. Do not early-return on `stale-by-policy`: leave-in-place
  // may still list already-rendered handles in `ads` (same pattern as usePooledAd).
  if (status === 'no-fill') {
    return <Text onPress={retry}>Nothing to show, tap to retry</Text>;
  }
  if (status === 'error') {
    return <Text onPress={retry}>Load failed: {errors[0]?.reason}. Tap to retry.</Text>;
  }
  // `loaded-partial` still has a usable handle, plus load-time errors from the
  // same request. Log the errors (not tied to a format); render the winner.
  if (status === 'loaded-partial') {
    console.warn(
      'partial multi-format fill',
      errors.map(e => `${e.reason}/${e.phase}`),
    );
  }

  // The hook drops an unrendered handle that goes stale by policy.
  // Already-rendered handles stay in `ads`; only empty UI when none remain.
  if (ads.length === 0) {
    return status === 'stale-by-policy' ? (
      <Text onPress={retry}>Ad stale by policy, tap to reload</Text>
    ) : null;
  }

  const handle = ads[0]!;

  return (
    <View>
      {/* Optional stale hint; keep rendering leave-in-place handles below. */}
      {status === 'stale-by-policy' ? <Text>Ad stale by policy, load again.</Text> : null}
      {handle.format === AdFormat.NATIVE ? (
        <NativeAdView nativeAd={handle.ad}>
          <NativeAsset assetType={NativeAssetType.HEADLINE}>
            <Text>{handle.ad.headline}</Text>
          </NativeAsset>
        </NativeAdView>
      ) : (
        /* Narrowed to the banner arm by the ternary above, so no assertion. */
        <MultiFormatBannerAdView handle={handle} />
      )}
    </View>
  );
}
```

Imperative equivalent (same shapes, no hook), so the caller owns both destruction and the age check, per [Expiry: two different scopes](#expiry-two-different-scopes):

```ts
const request = MultiFormatAdRequest.create({
  adUnitId: UNIT,
  requestOptions: MultiFormatAdPresets.nativeOrBanner([BannerAdSize.MEDIUM_RECTANGLE]),
});
const { ads, errors } = await request.load();

const handle = ads[0];
if (handle && !handle.isStaleByPolicy()) {
  const unsub = handle.onStaleByPolicy(() => {
    // Destroy only if this handle was never rendered; blanking a visible slot
    // after the impression was counted is user-hostile.
    handle.destroy();
  });
  // …render, then unsub() and handle.destroy() when done
  console.log(handle.adId, handle.observedAt, handle.provenance, unsub);
}
console.log(errors.map(e => e.reason));
```

`MultiFormatAdPresets.nativeOrBanner` returns request options only, so it drops straight into the `requestOptions` slot of a `MultiFormatAdConfig` and the ad unit stays at the top level beside it.

---

### 5. Imperative pool: no provider

Useful outside React or when you want explicit lifetime:

```ts
import { AdFormat, AdPools, AdPoolPresets, TestIds } from 'react-native-google-mobile-ads';

const unit = TestIds.INTERSTITIAL;
const pool = await AdPools.create(AdPoolPresets.fullscreen(AdFormat.INTERSTITIAL, unit));

pool.addListener(event => {
  if (event.type === 'error') {
    console.warn(event.error.reason, event.error.phase);
  }
  // Library-managed pools only: per-ad eviction, correlated by adId.
  if (event.type === 'expired') {
    console.log('pool ad evicted', event.adId, event.reason, event.provenance);
  }
  // Library-managed only: replacedAdId ties this fill to the expired event above.
  if (event.type === 'refreshed') {
    console.log('pool refilled', event.adId, 'replacing', event.replacedAdId);
  }
  // SDK-managed: buffer empty, cause unknown (onAdsExhausted / adsExhausted).
  if (event.type === 'exhausted') {
    console.log('pool exhausted', event.poolId);
  }
  // SDK-managed: a response id became available (pair with exhausted for refresh).
  if (event.type === 'available') {
    console.log('pool available', event.responseId);
  }
});

// Count is always present; upper bound (no Android V2 expiry sweep).
const { available, observedCount } = await pool.getAvailability();
console.log(available, observedCount);

const result = await pool.poll();
switch (result.status) {
  case 'filled':
    // An ad came out of the buffer. That is not a freshness guarantee.
    if (result.ad.format === AdFormat.INTERSTITIAL) {
      await result.ad.show();
      result.ad.destroy();
    }
    break;
  case 'empty':
  case 'timeout':
    // Not errors: the pool is still refilling. Try again later.
    break;
  case 'no-fill':
  case 'error':
    console.warn(result.error.reason);
    break;
}

pool.destroy(); // or AdPools.destroyAll()
```

Lookup later:

```ts
AdPools.get(`fullscreen-${AdFormat.INTERSTITIAL}-${unit}`);
```

---

### 6. Error handling (`reason` + `phase`)

`code` / `message` stay as today. Use **`reason`** for cross-platform branching and **`phase`** to tell load vs show failures (no separate show-failed event).

Those fields are **required** on the structured delivery surfaces that share one payload shape: `AdEventType.ERROR` payloads are `Error & AdErrorPayload`, the hooks expose `AdError` (exactly `NativeError & AdErrorPayload`), and the pool data records carry `AdErrorPayload`. So the branching below reads the same on a hook error as on an event payload.

The **banner / GAM banner** `onAdFailedToLoad` prop is the deliberate exception: it is typed `Error & Partial<AdErrorPayload>` so existing `(error: Error) => void` handlers stay assignable under `strictFunctionTypes`. Treat `reason` / `phase` as optional there (`error.reason === 'no-fill'` is fine; do not assume they are always present).

```ts
import { AdEventType, InterstitialAd, TestIds } from 'react-native-google-mobile-ads';

const ad = InterstitialAd.createForAdRequest(TestIds.INTERSTITIAL);

ad.addAdEventListener(AdEventType.ERROR, error => {
  // error is Error & AdErrorPayload when wired
  if (error.reason === 'no-fill' || error.reason === 'mediation-no-fill') {
    // distinct no-fill; required fields on event / hook / pool surfaces
  } else if (error.phase === 'show') {
    // fail-to-show (exactly one ERROR event)
  } else {
    console.warn(error.phase, error.reason, error.message);
  }
  // optional auction snapshot on the failure
  console.debug(error.responseInfo?.responseId);
});

ad.load();
```

Banner prop form (`Partial` exception; `reason` / `phase` may be absent):

```tsx
<BannerAd
  unitId={TestIds.BANNER}
  size={BannerAdSize.BANNER}
  onAdFailedToLoad={error => {
    // Error & Partial<AdErrorPayload>: guard before treating as structured
    if (error.reason === 'no-fill') {
      // …
    }
  }}
/>
```

Where each failure shows up:

| Surface                                  | Where the failure lands                                                                       |
| ---------------------------------------- | --------------------------------------------------------------------------------------------- |
| Classic `AdEventType.ERROR`              | Listener payload `Error & AdErrorPayload` (`reason` / `phase` required when wired)            |
| Banner / GAM `onAdFailedToLoad`          | `Error & Partial<AdErrorPayload>` (additive; `reason` / `phase` optional)                     |
| Pool `addListener` `{ type: 'error' }`   | `AdErrorPayload` on the event                                                                 |
| Pool creation (provider)                 | `useAdPool(…)` `status: 'error'` plus `error: AdError`; call `retry()` to try again           |
| Imperative `AdPools.create`              | Promise **rejects** (impossible config / stub)                                                |
| `poll()` (hook)                          | `usePooledAd(…)` `status: 'no-fill' \| 'error'` plus `error: AdError`; `poll()` never rejects |
| Imperative `pool.poll()`                 | `PollResult` `no-fill` / `error` carrying `AdErrorPayload`; never a rejection                 |
| Multi-format hook load                   | `useMultiFormatAd(…).errors` (`AdError[]`) with `status: 'error'` or `'loaded-partial'` — handle present and `errors[]` from the same load; errors are load-scoped, not per-format |
| Imperative `MultiFormatAdRequest.load()` | Resolved `errors: AdError[]` when wired; **stub today rejects** the promise                   |
| `MultiFormatAdRequest.create`            | Stub stores config without validation; wired implementation is intended to throw synchronously on illegal config |

Because hook errors are `AdError`, `error.reason` and `error.phase` are real values there, not `undefined`:

```ts
const pooled = usePooledAd(POOL_ID);
if (pooled.status === 'error' && pooled.error.reason === 'network-error') {
  // same branching as the event payload above; `error` is narrowed to AdError
  console.warn(pooled.error.phase, pooled.error.message, pooled.error.responseInfo?.responseId);
}
```

Note the deliberate splits. `empty`, `timeout`, and `stale-by-policy` are **not** errors, because the pool is still refilling or the held ad simply crossed the publisher window, so they never populate `error`. `no-fill` is separated from `error` on both `usePooledAd` and `useMultiFormatAd`, so a routine ad-server no-fill is never reported as a failure with an empty `errors` array.

---

### 7. Response metadata and paid events

After a successful load, read `responseInfo` on the ad / handle. On `PAID`, prefer `valueMicros` when present and walk the loaded adapter row for waterfall debugging. See [Metadata](#metadata-additive) (no eCPM helpers).

```ts
import { AdEventType, InterstitialAd, TestIds } from 'react-native-google-mobile-ads';

const ad = InterstitialAd.createForAdRequest(TestIds.INTERSTITIAL);

ad.addAdEventListener(AdEventType.LOADED, () => {
  const info = ad.responseInfo;
  console.log('responseId', info?.responseId);
  console.log('winning adapter', info?.loadedAdapterResponse?.adSourceName);
  // Every row reports identity and latency; `outcome` narrows the error.
  console.log(
    'waterfall',
    info?.adapterResponses?.map(r => ({
      source: r.adSourceName,
      latencyMillis: r.latencyMillis,
      error: r.outcome === 'error' ? r.adError.message : null,
    })),
  );
  console.log('GAM extras', info?.extras); // lineItemId, creativeId, …
});

ad.addAdEventListener(AdEventType.PAID, paid => {
  // paid: { currency, precision, value, valueMicros?, responseInfo? }
  const micros = paid.valueMicros; // decimal string, or null if not exact
  const source = paid.responseInfo?.loadedAdapterResponse?.adSourceName;
  analytics.logRevenue({
    currency: paid.currency,
    value: paid.value,
    valueMicros: micros,
    adapter: source,
    responseId: paid.responseInfo?.responseId,
  });
});

ad.load();
```

Same `responseInfo` field exists on `NativeAd`, multi-format handles, and pooled ads once wired. `peekResponseInfo()` on a pool is a **non-reserving** snapshot (racy, do not treat it as a poll). It reports the head of the buffer only and carries no time information, so it is not an age check. Gate with `getAdCapabilities().poolResponseInfoPeek` first: classic Android has no peek API (`unavailable` → hard-error `'pool/peek-unsupported'`); classic iOS supports a head peek when wired. On a supported backend, resolved `null` means the head is empty; it must not be read as "peek unsupported".

---


## Migration sketches

Additive: existing names and call shapes stay. Three common moves when you opt in:

**Positional hook → options form (the one migration every app will do)**

```tsx
// Before: the hook holds the ad but you drive the load.
const { isLoaded, error, load, show } = useInterstitialAd(unit);
useEffect(() => {
  if (consentReady) load();
}, [consentReady, load]);

// After: the automatic-load policy replaces the effect, and one status replaces the booleans.
const { status, error, show } = useInterstitialAd({
  adUnitId: unit,
  autoLoad: consentReady,
});
const isLoaded = status === 'loaded'; // if you want to keep the old name
```

Field-by-field, so nothing goes missing:

| Positional form  | Options form                              |
| ---------------- | ----------------------------------------- |
| `isLoaded`       | `status === 'loaded'`                     |
| `isShowing`      | `status === 'showing'`                    |
| `isClosed`       | `status === 'closed'`                     |
| `isOpened`       | `status === 'showing' \|\| status === 'closed'` |
| `isClicked`      | `clicked`                                 |
| `error?: Error`  | `error: AdError \| null`, plus a `'no-fill'` status split out of failure |
| `revenue`        | `revenue`                                 |
| `reward`         | `reward` (rewarded hooks)                 |
| `isEarnedReward` | `earnedReward` (rewarded hooks)           |
| `responseInfo`   | `responseInfo`                            |
| `load` / `show` / `destroy` | unchanged, plus `retry`        |

**Multi-format positional → one config object**

```ts
// Before
useMultiFormatAd(unit, MultiFormatAdPresets.nativeOrBanner([MEDIUM_RECTANGLE]));
MultiFormatAdRequest.create(unit, MultiFormatAdPresets.nativeOrBanner([MEDIUM_RECTANGLE]));

// After: the hook takes the imperative config plus an automatic-load policy, so both paths agree.
const config = {
  adUnitId: unit,
  requestOptions: MultiFormatAdPresets.nativeOrBanner([MEDIUM_RECTANGLE]),
};
useMultiFormatAd({ ...config, autoLoad: consentReady });
MultiFormatAdRequest.create(config);
```

**Classic interstitial → fullscreen pool (shape change at show time)**

```ts
// Before
const ad = InterstitialAd.createForAdRequest(unit);
ad.addAdEventListener(AdEventType.LOADED, () => ad.show());
ad.load();

// After (imperative sketch)
const pool = await AdPools.create(AdPoolPresets.fullscreen(AdFormat.INTERSTITIAL, unit));
const result = await pool.poll();
if (result.status === 'filled' && result.ad.format === AdFormat.INTERSTITIAL) {
  if (!result.ad.isStaleByPolicy()) await result.ad.show();
  result.ad.destroy();
}
```

**Classic banner/native → multi-format (one winner)**

```ts
// Before: pick one format yourself
// After: one request, render the winner
const { status, ads, load } = useMultiFormatAd({
  adUnitId: unit,
  requestOptions: MultiFormatAdPresets.nativeOrBanner([BannerAdSize.MEDIUM_RECTANGLE]),
});
// mount: void load(); then branch on ads[0].format
```

Full React provider flows: [Usage examples](#usage-examples).

---

## First failure modes

| Symptom | Likely cause |
| ------- | ------------ |
| `useAdPool` / `usePooledAd` stuck on `absent` | `poolId` typo or missing `AdPoolProvider` entry for that id |
| `usePooledAd` idle with empty buffer, create never runs | Provider missing or `pools` config omitted that id (pair with `useAdPool` / `poolStatus`) |
| Two placements starve each other | Two `usePooledAd(sameId)` owners on a depth-1 pool |
| `destroy()` then hook still looks filled | Destroyed hook-owned inventory; `release()` first |
| A hook loads twice in development | React StrictMode double-invokes effects; automatic loading is keyed per ad unit and `load()` coalesces per instance, so only one request goes out |
| Options-form hook sits on `'idle'` forever | `autoLoad` is false. Read the echoed `autoLoad` on the result to confirm, rather than guessing from `status` |
| Next ad never warms after dismissal | By design: automatic loading does not re-fire after `'closed'`. See [Reloading after dismissal](#reloading-after-dismissal) |
| `useInterstitialAd(unit)` is struck through in the editor | The positional overload is deprecated; pass an options object. Removed in version 18 |
| `MultiFormatAdRequest.load()` rejects today | Stub; hooks resolve empty/`no-fill` instead. See stub notes per section |
| Exhaustive `switch` on `'timeout'` never hits | `pollTimeoutMillis` omitted (see [defaults](#config-defaults-and-adserver-asymmetry)) |

---

## Out of this surface (v1)

- Custom native formats
- `numberOfAds` / `requestCount` greater than 1
- Mediation host packages (MAX, CloudX, etc.): use scoped GAM adapter packages separately
- Shim removal
