import type { PublicApiExport, PublicApiKind } from './publicApiMatrix.ts';

export type TypeProofStatus = 'covered' | 'deferred';

export type TypeProofEntry = {
  api: string;
  kind: PublicApiKind;
  status: TypeProofStatus;
  /**
   * For covered: which type-test file owns the proof (identifier mention only —
   * not necessarily a structural Equal lock).
   * For deferred: why type-test coverage is still open.
   */
  note: string;
};

/**
 * Type-only exports, hooks, and components that still lack a `type-test.ts` /
 * `type-test.tsx` identifier mention. Fail-closed: every matrix type-only/hook/component
 * must be covered or listed here. Remove an entry when type-test gains the symbol.
 *
 * Coverage detection is an identifier scrape of type-test sources (not structural
 * Equal proof). Prefer adding Equal / assignability locks in type-test when closing gaps.
 */
export const TYPE_PROOF_DEFERRED: Readonly<Record<string, string>> = {
  AdapterResponseError: 'Type-only adapter error shape; pending type-test Equal lock.',
  AdapterResponseInfoBase: 'Type-only base shape; pending type-test Equal lock.',
  AdapterStatus: 'Type-only initialize status row; pending type-test Equal lock.',
  AdErrorReason: 'Type-only error reason union; pending type-test Equal lock.',
  AdEventsListener: 'Type-only listener alias; pending type-test Equal lock.',
  AdHookReturns: 'Legacy hook return alias; pending type-test Equal lock.',
  AdInventoryProvenance: 'Type-only provenance union; pending type-test Equal lock.',
  AdPoolDegradeReason: 'Type-only pool degrade reason; pending type-test Equal lock.',
  AdPoolResolvedConfig: 'Type-only resolved pool config; pending type-test Equal lock.',
  AdPoolsApi: 'Type-only AdPools namespace shape; pending type-test Equal lock.',
  AdShowOptions: 'Show options type; pending type-test Equal lock.',
  AdStalenessWindowSource: 'Type-only staleness source; pending type-test Equal lock.',
  AdStates: 'Legacy ad-state alias; pending type-test Equal lock.',
  CollapsiblePlacement: 'Banner collapsible placement union; pending type-test Equal lock.',
  FullscreenAdFormat: 'Type-only fullscreen format union; pending type-test Equal lock.',
  FullScreenAdHookOptions: 'Shared fullscreen hook options; pending type-test Equal lock.',
  MobileAd: 'Type-only MobileAd interface; pending type-test Equal lock.',
  MultiFormatAdFormat: 'Type-only multi-format union; pending type-test Equal lock.',
  NativeAdRequestOptions: 'Native request options; pending type-test Equal lock.',
  PaidResponseInfo: 'Paid response-info shape; pending type-test Equal lock.',
  PooledAdExpiry: 'Type-only pooled expiry; pending type-test Equal lock.',
  PooledAdIdentity: 'Type-only pooled identity; pending type-test Equal lock.',
  RequestConfiguration: 'MobileAds request configuration; pending type-test Equal lock.',
  RequestOptions: 'Shared request options; pending type-test Equal lock.',
  ResponseInfoExtras: 'ResponseInfo extras; pending type-test Equal lock.',
  ServerSideVerificationOptions: 'SSV options; pending type-test Equal lock.',
  UseAppOpenAdOptions: 'App-open hook options; pending type-test Equal lock.',
  UseFullScreenAdResult: 'Shared fullscreen hook result; pending type-test Equal lock.',
  UseRewardedInterstitialAdOptions: 'RWI hook options; pending type-test Equal lock.',
  UseRewardedInterstitialAdResult: 'RWI hook result; pending type-test Equal lock.',
};

function collectMentionedApis(typeTestSources: readonly string[]): Set<string> {
  const mentioned = new Set<string>();
  const identifier = /\b[A-Za-z_][A-Za-z0-9_]*\b/g;
  for (const source of typeTestSources) {
    for (const match of source.matchAll(identifier)) {
      mentioned.add(match[0]);
    }
  }
  return mentioned;
}

function typeProofTargets(matrix: readonly PublicApiExport[]): PublicApiExport[] {
  return matrix.filter(
    entry =>
      entry.partition === 'product' &&
      (!entry.runtime || entry.kind === 'hook' || entry.kind === 'component'),
  );
}

export function deriveTypeProofRegistry(
  matrix: readonly PublicApiExport[],
  typeTestSources: readonly string[],
): readonly TypeProofEntry[] {
  const mentioned = collectMentionedApis(typeTestSources);
  return typeProofTargets(matrix)
    .map(entry => {
      if (mentioned.has(entry.name)) {
        return {
          api: entry.name,
          kind: entry.kind,
          status: 'covered' as const,
          note: 'Identifier mentioned in packages/core/type-test.ts or packages/core/type-test.tsx (yarn tsc:compile); scrape-based, not necessarily Equal-locked.',
        };
      }
      const deferredNote = TYPE_PROOF_DEFERRED[entry.name];
      if (!deferredNote) {
        return {
          api: entry.name,
          kind: entry.kind,
          status: 'deferred' as const,
          note: 'MISSING_DEFERRED_ROW',
        };
      }
      return {
        api: entry.name,
        kind: entry.kind,
        status: 'deferred' as const,
        note: deferredNote,
      };
    })
    .sort((left, right) => left.api.localeCompare(right.api));
}

export function validateTypeProofRegistry(
  matrix: readonly PublicApiExport[],
  typeTestSources: readonly string[],
): string[] {
  const errors: string[] = [];
  const mentioned = collectMentionedApis(typeTestSources);
  const targets = typeProofTargets(matrix);
  const targetNames = new Set(targets.map(entry => entry.name));

  for (const api of Object.keys(TYPE_PROOF_DEFERRED)) {
    if (!targetNames.has(api)) {
      errors.push(`type-proof deferred registry references unknown API ${api}`);
    }
    if (mentioned.has(api)) {
      errors.push(
        `type-proof deferred API ${api} is mentioned in type-test sources; remove it from TYPE_PROOF_DEFERRED`,
      );
    }
  }

  for (const entry of targets) {
    if (mentioned.has(entry.name)) {
      continue;
    }
    if (!TYPE_PROOF_DEFERRED[entry.name]) {
      errors.push(
        `type-proof gap for ${entry.name}: add type-test coverage or an explicit TYPE_PROOF_DEFERRED reason`,
      );
    }
  }
  return errors;
}

export function typeProofSummary(
  matrix: readonly PublicApiExport[],
  typeTestSources: readonly string[],
): { covered: number; deferred: number } {
  const registry = deriveTypeProofRegistry(matrix, typeTestSources);
  return {
    covered: registry.filter(entry => entry.status === 'covered').length,
    deferred: registry.filter(entry => entry.status === 'deferred').length,
  };
}
