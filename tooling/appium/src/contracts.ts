import type { PublicApiExport, PublicApiKind } from './publicApiMatrix.ts';
import { AppiumTestIds } from './testIds.ts';
import {
  REPRESENTATIVE_REQUEST_OUTCOME_CONTRACTS,
  SMOKE_BANNER_VARIANT,
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
  absent('AdPoolPresets', 'namespace/object'),
  absent('AdPoolPresets.display', 'function'),
  absent('AdPoolPresets.fullscreen', 'function'),
  absent('AdPoolProvider', 'component'),
  absent('AdPools', 'namespace/object'),
  absent('AdPools.create', 'function'),
  absent('AdPools.destroyAll', 'function'),
  absent('AdPools.get', 'function'),
  absent('AdPools.getCapabilities', 'function'),
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
  lower(
    'AppOpenAd',
    'class',
    'The example exposes structured load outcomes and show-lifecycle markers on LoadableAdControls. Jest covers load/show lifecycle mapping; automated creative display or clicking is deliberately excluded until a later Appium contract asserts those surfaces.',
  ),
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
  lower(
    'default',
    'function',
    'The default MobileAds factory is covered by Jest native-module delegation tests. Inspector/debug is navigation-only today; any future Appium assertion is capped at root-appears-and-closes, never ad delivery.',
  ),
  lower(
    'GAMAdEventType',
    'const/preset',
    'Jest covers GAM app-event payload mapping; event delivery depends on ad-server inventory and is not an independent Appium success outcome.',
  ),
  lower(
    'GAMBannerAd',
    'component',
    'The example renders GAM banner variants with request-outcome text and a measurable rendered wrapper; recordManualImpression() can prove invocation in lower-layer tests but can never prove server-side impression recording.',
  ),
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
      'A fresh Load request reaches the structured loaded lifecycle outcome within the bounded retry contract; Show is never invoked.',
  }),
  absent('getAdCapabilities', 'function'),
  staticToken('InitializationState'),
  outcome('InterstitialAd', 'class', {
    contractId: AppiumTestIds.format.interstitial,
    exampleComponent: 'LoadableAdControls',
    screenTestId: AppiumTestIds.format.interstitial,
    screenTestIdExpression: 'props.formatId',
    assertionTestId: AppiumTestIds.action.loaded(AppiumTestIds.format.interstitial),
    assertionTestIdExpression: 'AppiumTestIds.action.loaded(props.formatId)',
    success: 'lifecycle-event',
    assertion:
      'A fresh Load request reaches the structured loaded lifecycle outcome within the bounded retry contract; Show is never invoked.',
  }),
  staticToken('MaxAdContentRating'),
  lower(
    'MobileAds',
    'function',
    'Jest covers initialization and native-module delegation. Inspector/debug is navigation-only today; any future Appium assertion is capped at root-appears-and-closes and cannot claim an ad outcome.',
  ),
  absent('MultiFormatAdPresets', 'namespace/object'),
  absent('MultiFormatAdPresets.nativeOrBanner', 'function'),
  absent('MultiFormatAdRequest', 'class'),
  absent('MultiFormatBannerAdView', 'component'),
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
  lower(
    'RewardedAd',
    'class',
    'The example exposes structured load outcomes and show-lifecycle markers on LoadableAdControls. Jest covers lifecycle/reward mapping; Appium does not show or click ad creatives until a later contract asserts those surfaces.',
  ),
  lower(
    'RewardedAdEventType',
    'const/preset',
    'Jest covers rewarded lifecycle and reward payload mapping; earning a reward requires showing a creative, which the automated Appium suite deliberately avoids.',
  ),
  lower(
    'RewardedInterstitialAd',
    'class',
    'The example exposes structured load outcomes and show-lifecycle markers on LoadableAdControls. Jest covers lifecycle/reward mapping; Appium does not show or click creatives until a later contract asserts those surfaces.',
  ),
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
  absent('useAdPool', 'hook'),
  lower(
    'useAppOpenAd',
    'hook',
    'The App Open hook screen exposes hook status and lifecycle markers via stable testIDs. Jest covers state transitions and listener cleanup; Appium does not show an App Open creative or assert hook state transitions yet.',
  ),
  lower(
    'useForeground',
    'hook',
    'Jest drives deterministic AppState transitions and listener cleanup; device foreground timing is not asserted as an ad-success outcome.',
  ),
  lower(
    'useInterstitialAd',
    'hook',
    'The interstitial hook screen exposes hook status and lifecycle markers via stable testIDs. Jest covers load/status/listener transitions; no hook state transition is currently asserted by Appium.',
  ),
  absent('useMultiFormatAd', 'hook'),
  absent('usePooledAd', 'hook'),
  lower(
    'useRewardedAd',
    'hook',
    'The rewarded hook screen exposes hook status, earned flags, and lifecycle markers via stable testIDs. Jest covers load/reward/status transitions; Appium does not show a creative to earn a reward or assert hook transitions yet.',
  ),
  lower(
    'useRewardedInterstitialAd',
    'hook',
    'The rewarded interstitial hook screen exposes hook status, earned flags, and lifecycle markers via stable testIDs. Jest covers load/reward/status transitions; Appium does not show a creative to earn a reward or assert hook transitions yet.',
  ),
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
        (contract.success === 'structured-unsupported-result' &&
          !/\bstructured\b.*\bunsupported\b|\bunsupported\b.*\bstructured\b/i.test(
            contract.assertion,
          ))
      ) {
        errors.push(`e2e-outcome ${contract.api} has a presence-only success assertion`);
      }
      const knownContract = REPRESENTATIVE_REQUEST_OUTCOME_CONTRACTS.find(
        candidate => candidate.id === contract.contractId,
      );
      if (!knownContract) {
        errors.push(`e2e-outcome ${contract.api} references unknown contract ${contract.contractId}`);
      } else {
        if (contract.screenTestId !== knownContract.id) {
          errors.push(`e2e-outcome ${contract.api} references missing screen testID`);
        }
        const expectedAssertionTestId =
          contract.success === 'rendered-nonzero-view'
            ? AppiumTestIds.action.rendered(knownContract.id)
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
