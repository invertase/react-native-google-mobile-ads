import type { PublicApiExport, PublicApiKind } from './publicApiMatrix.ts';
import { AppiumTestIds } from './testIds.ts';
import {
  REPRESENTATIVE_REQUEST_OUTCOME_CONTRACTS,
  SDK_UTILITY_SURFACE_CONTRACTS,
  SMOKE_BANNER_VARIANT,
  SMOKE_GAM_BANNER_VARIANT,
} from './formats.ts';
import ts from 'typescript';

export type PublicApiDisposition =
  | 'e2e-outcome'
  | 'lower-layer-only'
  | 'not-appium-capable'
  | 'absent-from-example';

type DispositionBase = {
  api: string;
  kind: PublicApiKind;
  disposition: PublicApiDisposition;
};

export type E2eOutcomeDisposition = DispositionBase & {
  disposition: 'e2e-outcome';
  contractId: string;
  exampleComponent: string;
  screenTestId: string;
  screenTestIdExpression: string;
  assertionTestId: string;
  assertionTestIdExpression: string;
  success:
    | 'rendered-nonzero-view'
    | 'hook-state-transition'
    | 'lifecycle-event'
    | 'utility-open-close'
    | 'structured-unsupported-result';
  assertion: string;
};

export type ReasonedDisposition = DispositionBase & {
  disposition: 'lower-layer-only' | 'not-appium-capable' | 'absent-from-example';
  reason: string;
};

export type PublicApiContract = E2eOutcomeDisposition | ReasonedDisposition;

function outcome(
  api: string,
  kind: PublicApiKind,
  contract: Omit<E2eOutcomeDisposition, 'api' | 'kind' | 'disposition'>,
): E2eOutcomeDisposition {
  return { api, kind, disposition: 'e2e-outcome', ...contract };
}

function lower(api: string, kind: PublicApiKind, reason: string): ReasonedDisposition {
  return { api, kind, disposition: 'lower-layer-only', reason };
}

function excluded(api: string, kind: PublicApiKind, reason: string): ReasonedDisposition {
  return { api, kind, disposition: 'not-appium-capable', reason };
}

function absent(api: string, kind: PublicApiKind): ReasonedDisposition {
  return {
    api,
    kind,
    disposition: 'absent-from-example',
    reason: `${api} is part of the v17 pool/provider/multi-format surface, but RNGoogleMobileAdsExample has no screen that exercises this behavior.`,
  };
}

const parkedConsent = (api: string, kind: PublicApiKind): ReasonedDisposition =>
  excluded(
    api,
    kind,
    `Consent/UMP is parked by explicit maintainer decision. ${api} requires a maintained UMP app ID and consent form, which this example intentionally does not provide, so Appium must not claim an outcome.`,
  );

const staticToken = (api: string): ReasonedDisposition =>
  excluded(
    api,
    'const/preset',
    `${api} is a runtime token/value set with no independent operation or observable successful outcome; consumers of the value are dispositioned separately.`,
  );

export const PUBLIC_API_CONTRACTS: readonly PublicApiContract[] = [
  lower(
    'AdEventType',
    'const/preset',
    'Fullscreen lifecycle and paid-event payload mapping are asserted in Jest; paid-event delivery is nondeterministic on Google test inventory and is not a blocking Appium success condition.',
  ),
  staticToken('AdFormat'),
  lower(
    'AdPoolPresets',
    'namespace/object',
    'Preset config builders are exercised through the gallery pool provider and imperative create surfaces; no independent device outcome exists beyond those pool flows.',
  ),
  lower(
    'AdPoolPresets.display',
    'function',
    'Display preset configs are validated in Jest and consumed by the multi-format gallery surfaces; successful competitive native-or-banner outcomes are dispositioned on those multi-format contracts.',
  ),
  lower(
    'AdPoolPresets.fullscreen',
    'function',
    'Fullscreen preset configs are consumed by AdPoolProvider and AdPools.create gallery surfaces; successful preload outcomes are dispositioned on those pool contracts.',
  ),
  outcome('AdPoolProvider', 'component', {
    contractId: AppiumTestIds.format.poolInterstitialProvider,
    exampleComponent: 'PooledInterstitialProviderInner',
    screenTestId: AppiumTestIds.format.poolInterstitialProvider,
    screenTestIdExpression: 'AppiumTestIds.format.poolInterstitialProvider',
    assertionTestId: AppiumTestIds.action.loaded(AppiumTestIds.format.poolInterstitialProvider),
    assertionTestIdExpression:
      'AppiumTestIds.action.loaded(AppiumTestIds.format.poolInterstitialProvider)',
    success: 'hook-state-transition',
    assertion:
      'AdPoolProvider registers the interstitial pool, useAdPool state transition reaches ready poolStatus, poll drives pooledStatus to filled, then Show advances the pooled lifecycle marker through opened and closed without tapping ad creatives.',
  }),
  lower(
    'AdPools',
    'namespace/object',
    'The AdPools registry object is a namespace; each runtime member below carries its own disposition on the gallery pool surfaces.',
  ),
  outcome('AdPools.create', 'function', {
    contractId: AppiumTestIds.format.poolInterstitialImperative,
    exampleComponent: 'PooledInterstitialImperativeFormat',
    screenTestId: AppiumTestIds.format.poolInterstitialImperative,
    screenTestIdExpression: 'AppiumTestIds.format.poolInterstitialImperative',
    assertionTestId: AppiumTestIds.action.loaded(AppiumTestIds.format.poolInterstitialImperative),
    assertionTestIdExpression:
      'AppiumTestIds.action.loaded(AppiumTestIds.format.poolInterstitialImperative)',
    success: 'hook-state-transition',
    assertion:
      'AdPools.create registers an interstitial pool, poll drives a state transition to filled pooledStatus, then Show advances the pooled lifecycle marker through opened and closed without tapping ad creatives.',
  }),
  lower(
    'AdPools.destroyAll',
    'function',
    'destroyAll is invoked from the imperative pool gallery control and tears down registry state; the blocking Appium success outcome is the filled pooled show-close path on the same screen.',
  ),
  outcome('AdPools.get', 'function', {
    contractId: AppiumTestIds.format.poolInterstitialImperative,
    exampleComponent: 'PooledInterstitialImperativeFormat',
    screenTestId: AppiumTestIds.format.poolInterstitialImperative,
    screenTestIdExpression: 'AppiumTestIds.format.poolInterstitialImperative',
    assertionTestId: AppiumTestIds.action.loaded(AppiumTestIds.format.poolInterstitialImperative),
    assertionTestIdExpression:
      'AppiumTestIds.action.loaded(AppiumTestIds.format.poolInterstitialImperative)',
    success: 'hook-state-transition',
    assertion:
      'After AdPools.create, AdPools.get reports registry=true on the imperative pool screen while poll drives a state transition to filled pooledStatus, then Show advances the pooled lifecycle marker through opened and closed without tapping ad creatives.',
  }),
  outcome('AdPools.getCapabilities', 'function', {
    contractId: AppiumTestIds.format.poolCapabilityGates,
    exampleComponent: 'PoolCapabilityGatesFormat',
    screenTestId: AppiumTestIds.format.poolCapabilityGates,
    screenTestIdExpression: 'AppiumTestIds.format.poolCapabilityGates',
    assertionTestId: AppiumTestIds.action.loaded(AppiumTestIds.format.poolCapabilityGates),
    assertionTestIdExpression:
      'AppiumTestIds.action.loaded(AppiumTestIds.format.poolCapabilityGates)',
    success: 'structured-unsupported-result',
    assertion:
      'The capability snapshot is published on the loaded marker, and the peek probe reports a structured unsupported pool/peek-unsupported result on Android classic while iOS reports a supported peek terminal outcome.',
  }),
  parkedConsent('AdsConsent', 'namespace/object'),
  parkedConsent('AdsConsent.gatherConsent', 'function'),
  parkedConsent('AdsConsent.getConsentInfo', 'function'),
  parkedConsent('AdsConsent.getGdprApplies', 'function'),
  parkedConsent('AdsConsent.getPurposeConsents', 'function'),
  parkedConsent('AdsConsent.getPurposeLegitimateInterests', 'function'),
  parkedConsent('AdsConsent.getTCModel', 'function'),
  parkedConsent('AdsConsent.getTCString', 'function'),
  parkedConsent('AdsConsent.getUserChoices', 'function'),
  parkedConsent('AdsConsent.loadAndShowConsentFormIfRequired', 'function'),
  parkedConsent('AdsConsent.requestInfoUpdate', 'function'),
  parkedConsent('AdsConsent.reset', 'function'),
  parkedConsent('AdsConsent.showForm', 'function'),
  parkedConsent('AdsConsent.showPrivacyOptionsForm', 'function'),
  parkedConsent('AdsConsentDebugGeography', 'const/preset'),
  parkedConsent('AdsConsentPrivacyOptionsRequirementStatus', 'const/preset'),
  parkedConsent('AdsConsentPurposes', 'const/preset'),
  parkedConsent('AdsConsentSpecialFeatures', 'const/preset'),
  parkedConsent('AdsConsentStatus', 'const/preset'),
  lower(
    'AdStalenessGuidanceMillis',
    'const/preset',
    'Jest locks the exact staleness guidance values and policy timers; a numeric policy constant has no honest device-level success outcome.',
  ),
  staticToken('AgeRestrictedTreatment'),
  outcome('AppOpenAd', 'class', {
    contractId: AppiumTestIds.format.appOpen,
    exampleComponent: 'LoadableAdControls',
    screenTestId: AppiumTestIds.format.appOpen,
    screenTestIdExpression: 'props.formatId',
    assertionTestId: AppiumTestIds.action.loaded(AppiumTestIds.format.appOpen),
    assertionTestIdExpression: 'AppiumTestIds.action.loaded(props.formatId)',
    success: 'lifecycle-event',
    assertion:
      'A fresh Load request reaches the structured loaded lifecycle outcome, then Show drives the lifecycle marker through opened and closed without tapping ad creatives.',
  }),
  outcome('BannerAd', 'component', {
    contractId: SMOKE_BANNER_VARIANT,
    exampleComponent: 'BannerFormat',
    screenTestId: SMOKE_BANNER_VARIANT,
    screenTestIdExpression: 'formatId',
    assertionTestId: AppiumTestIds.action.rendered(SMOKE_BANNER_VARIANT),
    assertionTestIdExpression: 'AppiumTestIds.action.rendered(formatId)',
    success: 'rendered-nonzero-view',
    assertion:
      'After a loaded request outcome, the Banner wrapper and a displayed native descendant both have nonzero width and height.',
  }),
  staticToken('BannerAdSize'),
  outcome('default', 'function', {
    contractId: AppiumTestIds.format.debugMenu,
    exampleComponent: 'DebugMenuFormat',
    screenTestId: AppiumTestIds.format.debugMenu,
    screenTestIdExpression: 'formatId',
    assertionTestId: AppiumTestIds.action.lifecycle(AppiumTestIds.format.debugMenu),
    assertionTestIdExpression: 'AppiumTestIds.action.lifecycle(formatId)',
    success: 'utility-open-close',
    assertion:
      'MobileAds().openDebugMenu opens the native Debug Menu root UI, the Utility lifecycle marker reports opened, then after system back the marker reports closed without asserting SDK internals or ad delivery.',
  }),
  lower(
    'GAMAdEventType',
    'const/preset',
    'Jest covers GAM app-event payload mapping; event delivery depends on ad-server inventory and is not an independent Appium success outcome.',
  ),
  outcome('GAMBannerAd', 'component', {
    contractId: SMOKE_GAM_BANNER_VARIANT,
    exampleComponent: 'GAMBannerFormat',
    screenTestId: SMOKE_GAM_BANNER_VARIANT,
    screenTestIdExpression: 'AppiumTestIds.gamBannerVariant(gamSizesKey(props.sizes))',
    assertionTestId: AppiumTestIds.action.rendered(SMOKE_GAM_BANNER_VARIANT),
    assertionTestIdExpression: 'AppiumTestIds.action.rendered(formatId)',
    success: 'rendered-nonzero-view',
    assertion:
      'After a loaded GAM banner request outcome, the rendered wrapper and a displayed native descendant both have nonzero width and height; manual impression recording is not a blocking success condition because the SDK exposes no acknowledgement callback.',
  }),
  staticToken('GAMBannerAdSize'),
  outcome('GAMInterstitialAd', 'class', {
    contractId: AppiumTestIds.format.gamInterstitial,
    exampleComponent: 'GAMInterstitialFormat',
    screenTestId: AppiumTestIds.format.gamInterstitial,
    screenTestIdExpression: 'AppiumTestIds.format.gamInterstitial',
    assertionTestId: AppiumTestIds.action.loaded(AppiumTestIds.format.gamInterstitial),
    assertionTestIdExpression:
      'AppiumTestIds.action.loaded(AppiumTestIds.format.gamInterstitial)',
    success: 'lifecycle-event',
    assertion:
      'A fresh Load request reaches the structured loaded lifecycle outcome, then Show drives the lifecycle marker through opened and closed without tapping ad creatives.',
  }),
  outcome('getAdCapabilities', 'function', {
    contractId: AppiumTestIds.format.poolCapabilityGates,
    exampleComponent: 'PoolCapabilityGatesFormat',
    screenTestId: AppiumTestIds.format.poolCapabilityGates,
    screenTestIdExpression: 'AppiumTestIds.format.poolCapabilityGates',
    assertionTestId: AppiumTestIds.action.loaded(AppiumTestIds.format.poolCapabilityGates),
    assertionTestIdExpression:
      'AppiumTestIds.action.loaded(AppiumTestIds.format.poolCapabilityGates)',
    success: 'structured-unsupported-result',
    assertion:
      'getAdCapabilities publishes poolResponseInfoPeek and rewarded-interstitial preload support on the loaded marker, and the peek probe reports structured unsupported pool/peek-unsupported on Android classic rather than faking peek success.',
  }),
  lower(
    'InitializationState',
    'const/preset',
    'MobileAds.initialize runs during gallery startup and debug-menu pre-init, but the example never renders adapter initialization state, so Jest owns enum mapping while downstream ad contracts prove initialization indirectly.',
  ),
  outcome('InterstitialAd', 'class', {
    contractId: AppiumTestIds.format.interstitial,
    exampleComponent: 'LoadableAdControls',
    screenTestId: AppiumTestIds.format.interstitial,
    screenTestIdExpression: 'props.formatId',
    assertionTestId: AppiumTestIds.action.loaded(AppiumTestIds.format.interstitial),
    assertionTestIdExpression: 'AppiumTestIds.action.loaded(props.formatId)',
    success: 'lifecycle-event',
    assertion:
      'A fresh Load request reaches the structured loaded lifecycle outcome, then Show drives the lifecycle marker through opened and closed without tapping ad creatives.',
  }),
  staticToken('MaxAdContentRating'),
  outcome('MobileAds', 'function', {
    contractId: AppiumTestIds.format.adInspector,
    exampleComponent: 'AdInspectorFormat',
    screenTestId: AppiumTestIds.format.adInspector,
    screenTestIdExpression: 'formatId',
    assertionTestId: AppiumTestIds.action.lifecycle(AppiumTestIds.format.adInspector),
    assertionTestIdExpression: 'AppiumTestIds.action.lifecycle(formatId)',
    success: 'utility-open-close',
    assertion:
      'MobileAds().openAdInspector opens the native Ad Inspector root UI, the Utility lifecycle marker reports opened, then after system back the marker reports closed without asserting SDK internals or ad delivery.',
  }),
  lower(
    'MultiFormatAdPresets',
    'namespace/object',
    'Preset builders are exercised through the multi-format gallery request and hook surfaces; no independent device outcome exists beyond those competitive load flows.',
  ),
  lower(
    'MultiFormatAdPresets.nativeOrBanner',
    'function',
    'The nativeOrBanner preset is applied on the gallery MultiFormatAdRequest and useMultiFormatAd screens with TestIds.GAM_NATIVE; successful winner render outcomes are dispositioned on those contracts.',
  ),
  outcome('MultiFormatAdRequest', 'class', {
    contractId: AppiumTestIds.format.multiFormatRequest,
    exampleComponent: 'MultiFormatRequestFormat',
    screenTestId: AppiumTestIds.format.multiFormatRequest,
    screenTestIdExpression: 'formatId',
    assertionTestId: AppiumTestIds.action.rendered(AppiumTestIds.format.multiFormatRequest),
    assertionTestIdExpression: 'AppiumTestIds.action.rendered(formatId)',
    success: 'rendered-nonzero-view',
    assertion:
      'A fresh Load issues a GAM multi-format request, reaches the structured loaded lifecycle outcome with a documented winner format, then the native arm renders a displayed NativeAdView with nonzero width and height or the banner arm renders a displayed MultiFormatBannerAdView subtree with nonzero width and height.',
  }),
  outcome('MultiFormatBannerAdView', 'component', {
    contractId: AppiumTestIds.format.multiFormatRequest,
    exampleComponent: 'MultiFormatRequestFormat',
    screenTestId: AppiumTestIds.format.multiFormatRequest,
    screenTestIdExpression: 'formatId',
    assertionTestId: AppiumTestIds.action.rendered(AppiumTestIds.format.multiFormatRequest),
    assertionTestIdExpression: 'AppiumTestIds.action.rendered(formatId)',
    success: 'rendered-nonzero-view',
    assertion:
      'When the competitive multi-format request selects the banner winner, MultiFormatBannerAdView is displayed with nonzero width and height on the imperative gallery surface without issuing a second ad request.',
  }),
  outcome('NativeAd', 'class', {
    contractId: AppiumTestIds.format.native,
    exampleComponent: 'NativeComponent',
    screenTestId: AppiumTestIds.format.native,
    screenTestIdExpression: 'AppiumTestIds.format.native',
    assertionTestId: AppiumTestIds.action.rendered(AppiumTestIds.format.native),
    assertionTestIdExpression: 'AppiumTestIds.action.rendered(AppiumTestIds.format.native)',
    success: 'rendered-nonzero-view',
    assertion:
      'A loaded Native request renders a displayed NativeAdView with nonzero width and height; the documented Android malformed-creative fingerprint is the only structured alternate result.',
  }),
  staticToken('NativeAdChoicesPlacement'),
  lower(
    'NativeAdEventType',
    'const/preset',
    'Jest covers native lifecycle and paid payload mapping. Appium never clicks ad creatives, and paid-event delivery is nondeterministic on test inventory.',
  ),
  outcome('NativeAdView', 'component', {
    contractId: AppiumTestIds.format.native,
    exampleComponent: 'NativeComponent',
    screenTestId: AppiumTestIds.format.native,
    screenTestIdExpression: 'AppiumTestIds.format.native',
    assertionTestId: AppiumTestIds.action.rendered(AppiumTestIds.format.native),
    assertionTestIdExpression: 'AppiumTestIds.action.rendered(AppiumTestIds.format.native)',
    success: 'rendered-nonzero-view',
    assertion:
      'The accepted loaded Native outcome requires the NativeAdView itself to be displayed with nonzero width and height.',
  }),
  lower(
    'NativeAsset',
    'component',
    'Asset registration is covered by component/native command tests; the current Native Appium contract measures the enclosing NativeAdView and does not identify each asset.',
  ),
  staticToken('NativeAssetType'),
  lower(
    'NativeError',
    'class',
    'Jest asserts native error code, reason, phase, and response-info mapping; Appium consumes only the resulting structured terminal classification.',
  ),
  staticToken('NativeMediaAspectRatio'),
  lower(
    'NativeMediaView',
    'component',
    'Media-view command and prop wiring are covered below Appium; the current Native outcome does not require video inventory or assert media playback.',
  ),
  lower(
    'RevenuePrecisions',
    'const/preset',
    'Jest keeps paid-event precision and payload mapping; paid-event delivery is nondeterministic on Google test inventory and is not a blocking Appium contract.',
  ),
  outcome('RewardedAd', 'class', {
    contractId: AppiumTestIds.format.rewarded,
    exampleComponent: 'LoadableAdControls',
    screenTestId: AppiumTestIds.format.rewarded,
    screenTestIdExpression: 'props.formatId',
    assertionTestId: AppiumTestIds.action.loaded(AppiumTestIds.format.rewarded),
    assertionTestIdExpression: 'AppiumTestIds.action.loaded(props.formatId)',
    success: 'lifecycle-event',
    assertion:
      'A fresh Load request reaches the structured loaded lifecycle outcome, then Show drives the lifecycle marker through opened and closed without tapping ad creatives; paid-event delivery is not a blocking success condition.',
  }),
  lower(
    'RewardedAdEventType',
    'const/preset',
    'Jest covers rewarded lifecycle and reward payload mapping; earning a reward requires showing a creative, which the automated Appium suite deliberately avoids.',
  ),
  outcome('RewardedInterstitialAd', 'class', {
    contractId: AppiumTestIds.format.rewardedInterstitial,
    exampleComponent: 'LoadableAdControls',
    screenTestId: AppiumTestIds.format.rewardedInterstitial,
    screenTestIdExpression: 'props.formatId',
    assertionTestId: AppiumTestIds.action.loaded(AppiumTestIds.format.rewardedInterstitial),
    assertionTestIdExpression: 'AppiumTestIds.action.loaded(props.formatId)',
    success: 'lifecycle-event',
    assertion:
      'A fresh Load request reaches the structured loaded lifecycle outcome, then Show drives the lifecycle marker through opened and closed without tapping ad creatives; paid-event delivery is not a blocking success condition.',
  }),
  excluded(
    'SDK_VERSION',
    'const/preset',
    'SDK_VERSION is build metadata with no device behavior; its string value is verified by package build/version tooling rather than an Appium outcome.',
  ),
  excluded(
    'TestIds',
    'const/preset',
    'TestIds is a static inventory of Google test-unit strings; successful requests using selected IDs are dispositioned on the corresponding ad APIs.',
  ),
  outcome('useAdPool', 'hook', {
    contractId: AppiumTestIds.format.poolInterstitialProvider,
    exampleComponent: 'PooledInterstitialProviderInner',
    screenTestId: AppiumTestIds.format.poolInterstitialProvider,
    screenTestIdExpression: 'AppiumTestIds.format.poolInterstitialProvider',
    assertionTestId: AppiumTestIds.action.loaded(AppiumTestIds.format.poolInterstitialProvider),
    assertionTestIdExpression:
      'AppiumTestIds.action.loaded(AppiumTestIds.format.poolInterstitialProvider)',
    success: 'hook-state-transition',
    assertion:
      'useAdPool state transition surfaces ready poolStatus for the provider pool, poll drives pooledStatus to filled, then Show advances the pooled lifecycle marker through opened and closed without tapping ad creatives.',
  }),
  outcome('useAppOpenAd', 'hook', {
    contractId: AppiumTestIds.format.appOpenHook,
    exampleComponent: 'AppOpenHookFormat',
    screenTestId: AppiumTestIds.format.appOpenHook,
    screenTestIdExpression: 'AppiumTestIds.format.appOpenHook',
    assertionTestId: AppiumTestIds.action.loaded(AppiumTestIds.format.appOpenHook),
    assertionTestIdExpression:
      'AppiumTestIds.action.loaded(AppiumTestIds.format.appOpenHook)',
    success: 'hook-state-transition',
    assertion:
      'Load drives a hook state transition to loaded, then Show advances the Hook lifecycle marker through showing and closed without tapping ad creatives.',
  }),
  lower(
    'useForeground',
    'hook',
    'Jest drives deterministic AppState transitions and listener cleanup; device foreground timing is not asserted as an ad-success outcome.',
  ),
  lower(
    'useGAMInterstitialAd',
    'hook',
    'Jest owns options-form lifecycle parity with useInterstitialAd plus onAppEvent delivery; GAMInterstitialAd already has an e2e-outcome for the imperative Ad Manager interstitial path, and the example has no dedicated hook screen yet.',
  ),
  outcome('useInterstitialAd', 'hook', {
    contractId: AppiumTestIds.format.interstitialHook,
    exampleComponent: 'InterstitialHookFormat',
    screenTestId: AppiumTestIds.format.interstitialHook,
    screenTestIdExpression: 'AppiumTestIds.format.interstitialHook',
    assertionTestId: AppiumTestIds.action.loaded(AppiumTestIds.format.interstitialHook),
    assertionTestIdExpression:
      'AppiumTestIds.action.loaded(AppiumTestIds.format.interstitialHook)',
    success: 'hook-state-transition',
    assertion:
      'Auto-load drives a hook state transition to loaded, then Show advances the Hook lifecycle marker through showing and closed without tapping ad creatives.',
  }),
  outcome('useMultiFormatAd', 'hook', {
    contractId: AppiumTestIds.format.multiFormatHook,
    exampleComponent: 'MultiFormatHookFormat',
    screenTestId: AppiumTestIds.format.multiFormatHook,
    screenTestIdExpression: 'formatId',
    assertionTestId: AppiumTestIds.action.loaded(AppiumTestIds.format.multiFormatHook),
    assertionTestIdExpression: 'AppiumTestIds.action.loaded(formatId)',
    success: 'hook-state-transition',
    assertion:
      'Auto-load drives a hook state transition to loaded with a documented winner format, then the native arm renders a displayed NativeAdView with nonzero width and height or the banner arm renders a displayed MultiFormatBannerAdView subtree with nonzero width and height.',
  }),
  outcome('usePooledAd', 'hook', {
    contractId: AppiumTestIds.format.poolInterstitialProvider,
    exampleComponent: 'PooledInterstitialProviderInner',
    screenTestId: AppiumTestIds.format.poolInterstitialProvider,
    screenTestIdExpression: 'AppiumTestIds.format.poolInterstitialProvider',
    assertionTestId: AppiumTestIds.action.loaded(AppiumTestIds.format.poolInterstitialProvider),
    assertionTestIdExpression:
      'AppiumTestIds.action.loaded(AppiumTestIds.format.poolInterstitialProvider)',
    success: 'hook-state-transition',
    assertion:
      'usePooledAd poll drives a state transition to filled, then Show advances the pooled lifecycle marker through opened and closed without tapping ad creatives.',
  }),
  outcome('useRewardedAd', 'hook', {
    contractId: AppiumTestIds.format.rewardedHook,
    exampleComponent: 'RewardedHookFormat',
    screenTestId: AppiumTestIds.format.rewardedHook,
    screenTestIdExpression: 'AppiumTestIds.format.rewardedHook',
    assertionTestId: AppiumTestIds.action.loaded(AppiumTestIds.format.rewardedHook),
    assertionTestIdExpression: 'AppiumTestIds.action.loaded(AppiumTestIds.format.rewardedHook)',
    success: 'hook-state-transition',
    assertion:
      'Load drives a hook state transition to loaded, then Show advances the Hook lifecycle marker through showing and closed without tapping ad creatives; paid-event and earned-reward delivery are not blocking success conditions.',
  }),
  outcome('useRewardedInterstitialAd', 'hook', {
    contractId: AppiumTestIds.format.rewardedInterstitialHook,
    exampleComponent: 'RewardedInterstitialHookFormat',
    screenTestId: AppiumTestIds.format.rewardedInterstitialHook,
    screenTestIdExpression: 'AppiumTestIds.format.rewardedInterstitialHook',
    assertionTestId: AppiumTestIds.action.loaded(AppiumTestIds.format.rewardedInterstitialHook),
    assertionTestIdExpression:
      'AppiumTestIds.action.loaded(AppiumTestIds.format.rewardedInterstitialHook)',
    success: 'hook-state-transition',
    assertion:
      'Load drives a hook state transition to loaded, then Show advances the Hook lifecycle marker through showing and closed without tapping ad creatives; paid-event and earned-reward delivery are not blocking success conditions.',
  }),
] as const;

export function dispositionSummary(
  contracts: readonly PublicApiContract[] = PUBLIC_API_CONTRACTS,
): Record<PublicApiDisposition, number> {
  const summary: Record<PublicApiDisposition, number> = {
    'e2e-outcome': 0,
    'lower-layer-only': 0,
    'not-appium-capable': 0,
    'absent-from-example': 0,
  };
  for (const contract of contracts) {
    summary[contract.disposition] += 1;
  }
  return summary;
}

function componentExpressions(sourceText: string, componentName: string): Set<string> | undefined {
  const sourceFile = ts.createSourceFile(
    'App.tsx',
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  let component: ts.Node | undefined;
  sourceFile.forEachChild(node => {
    if (ts.isFunctionDeclaration(node) && node.name?.text === componentName) {
      component = node;
    }
  });
  if (!component) {
    return undefined;
  }
  const expressions = new Set<string>();
  const visit = (node: ts.Node): void => {
    if (
      ts.isIdentifier(node) ||
      ts.isPropertyAccessExpression(node) ||
      ts.isCallExpression(node)
    ) {
      expressions.add(node.getText(sourceFile));
    }
    ts.forEachChild(node, visit);
  };
  visit(component);
  return expressions;
}

export function validatePublicApiContracts(
  matrix: readonly PublicApiExport[],
  contracts: readonly PublicApiContract[],
  exampleSourceText: string,
): string[] {
  const errors: string[] = [];
  const publicBehaviors = new Map<string, PublicApiKind>();
  for (const exported of matrix) {
    if (exported.runtime) {
      publicBehaviors.set(exported.name, exported.kind);
      for (const member of exported.members) {
        publicBehaviors.set(member.name, member.kind);
      }
    }
  }

  const contractsByApi = new Map<string, PublicApiContract>();
  for (const contract of contracts) {
    if (contractsByApi.has(contract.api)) {
      errors.push(`duplicate disposition for ${contract.api}`);
      continue;
    }
    contractsByApi.set(contract.api, contract);
    const currentKind = publicBehaviors.get(contract.api);
    if (!currentKind) {
      errors.push(`registry references missing runtime API ${contract.api}`);
    } else if (currentKind !== contract.kind) {
      errors.push(
        `classification drift for ${contract.api}: registry=${contract.kind}, compiler=${currentKind}`,
      );
    }

    if (contract.disposition === 'e2e-outcome') {
      const requiredStrings = [
        contract.contractId,
        contract.exampleComponent,
        contract.screenTestId,
        contract.screenTestIdExpression,
        contract.assertionTestId,
        contract.assertionTestIdExpression,
        contract.assertion,
      ];
      if (requiredStrings.some(value => value.trim().length === 0)) {
        errors.push(`e2e-outcome ${contract.api} has an empty contract field`);
      }
      if (
        contract.assertion.trim().split(/\s+/).length < 8 ||
        /\b(?:presence[- ]only|is present|exists|opens successfully)\b/i.test(contract.assertion) ||
        (contract.success === 'rendered-nonzero-view' &&
          !/\bnonzero\b/i.test(contract.assertion)) ||
        (contract.success === 'lifecycle-event' &&
          !/\bloaded\b.*\blifecycle\b|\blifecycle\b.*\bloaded\b/i.test(contract.assertion)) ||
        (contract.success === 'hook-state-transition' &&
          !/\bstate transition\b/i.test(contract.assertion)) ||
        (contract.success === 'utility-open-close' &&
          (!/\bopened\b.*\bclosed\b|\bclosed\b.*\bopened\b/i.test(contract.assertion) ||
            /\bversion\b/i.test(contract.assertion))) ||
        (contract.success === 'structured-unsupported-result' &&
          !/\bstructured\b.*\bunsupported\b|\bunsupported\b.*\bstructured\b/i.test(
            contract.assertion,
          ))
      ) {
        errors.push(`e2e-outcome ${contract.api} has a presence-only success assertion`);
      }
      const knownContract = [
        ...REPRESENTATIVE_REQUEST_OUTCOME_CONTRACTS,
        ...SDK_UTILITY_SURFACE_CONTRACTS,
      ].find(candidate => candidate.id === contract.contractId);
      if (!knownContract) {
        errors.push(`e2e-outcome ${contract.api} references unknown contract ${contract.contractId}`);
      } else {
        if (contract.screenTestId !== knownContract.id) {
          errors.push(`e2e-outcome ${contract.api} references missing screen testID`);
        }
        const expectedAssertionTestId =
          contract.success === 'rendered-nonzero-view'
            ? AppiumTestIds.action.rendered(knownContract.id)
            : contract.success === 'utility-open-close'
              ? AppiumTestIds.action.lifecycle(knownContract.id)
              : AppiumTestIds.action.loaded(knownContract.id);
        if (contract.assertionTestId !== expectedAssertionTestId) {
          errors.push(`e2e-outcome ${contract.api} references missing assertion testID`);
        }
      }
      const expressions = componentExpressions(exampleSourceText, contract.exampleComponent);
      if (!expressions) {
        errors.push(
          `e2e-outcome ${contract.api} references missing example component ${contract.exampleComponent}`,
        );
      } else {
        for (const expression of [
          contract.screenTestIdExpression,
          contract.assertionTestIdExpression,
        ]) {
          if (!expressions.has(expression)) {
            errors.push(
              `e2e-outcome ${contract.api} references missing testID expression ${expression}`,
            );
          }
        }
      }
      if (
        !contract.screenTestId.startsWith('gma.') ||
        !contract.assertionTestId.startsWith('gma.')
      ) {
        errors.push(`e2e-outcome ${contract.api} references a non-Appium testID`);
      }
    } else if (
      contract.reason.trim().split(/\s+/).length < 10 ||
      /\b(?:hard to test|difficult to test|not testable|n\/a|todo)\b/i.test(contract.reason)
    ) {
      errors.push(`${contract.disposition} ${contract.api} has a missing or non-specific reason`);
    }
  }

  for (const api of publicBehaviors.keys()) {
    if (!contractsByApi.has(api)) {
      errors.push(`runtime public API ${api} has no disposition`);
    }
  }
  return errors;
}
