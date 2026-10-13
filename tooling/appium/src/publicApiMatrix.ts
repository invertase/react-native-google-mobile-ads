import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

export type PublicApiKind =
  | 'class'
  | 'function'
  | 'hook'
  | 'component'
  | 'const/preset'
  | 'type-only'
  | 'namespace/object';

export type PublicApiPartition = 'product' | 'example-probe';

export type PublicApiMember = {
  name: string;
  kind: PublicApiKind;
  runtime: true;
};

export type PublicApiExport = {
  name: string;
  kind: PublicApiKind;
  runtime: boolean;
  partition: PublicApiPartition;
  members: readonly PublicApiMember[];
};

/**
 * Example-only seams that must never appear in the product public-API matrix.
 * Pattern C probe TurboModule + coverage flush control — see running-e2e § Appium.
 */
export const EXAMPLE_PROBE_SURFACES = [
  {
    id: 'NativeRNGMATesting',
    partition: 'example-probe' as const,
    owner: 'RNGoogleMobileAdsExample/modules/rngma-testing',
    reason:
      'Example-only Pattern C probe TurboModule (@invertase/rngma-testing). Not a react-native-google-mobile-ads product export; tertiary Appium asserts probe seams only.',
  },
  {
    id: 'gma.debug.flushCoverage',
    partition: 'example-probe' as const,
    owner: 'RNGoogleMobileAdsExample',
    reason:
      'Example gallery coverage-flush control for react-native-coverage. Harness-only; not a product public API.',
  },
] as const;

/** Significant component props/events (excludes React View accessibility noise). */
const SIGNIFICANT_COMPONENT_PROPS: Readonly<Record<string, readonly string[]>> = {
  AdPoolProvider: ['children', 'enabled', 'pools'],
  BannerAd: [
    'unitId',
    'size',
    'maxHeight',
    'width',
    'requestOptions',
    'onAdLoaded',
    'onAdFailedToLoad',
    'onAdOpened',
    'onAdClosed',
    'onAdImpression',
    'onAdClicked',
    'onPaid',
    'onSizeChange',
  ],
  GAMBannerAd: [
    'unitId',
    'sizes',
    'maxHeight',
    'width',
    'requestOptions',
    'manualImpressionsEnabled',
    'onAdLoaded',
    'onAdFailedToLoad',
    'onAdOpened',
    'onAdClosed',
    'onAdImpression',
    'onAdClicked',
    'onPaid',
    'onSizeChange',
    'onAppEvent',
  ],
  MultiFormatBannerAdView: ['handle'],
  NativeAdView: ['nativeAd', 'children'],
  NativeAsset: ['assetType', 'children'],
  NativeMediaView: ['resizeMode'],
};

/** Significant instance/static methods on class components (not React lifecycle). */
const SIGNIFICANT_COMPONENT_METHODS: Readonly<Record<string, readonly string[]>> = {
  BannerAd: ['load'],
  GAMBannerAd: ['load', 'recordManualImpression'],
};

/** Significant methods/properties on ad classes (skips NativeAd asset getters / Error noise). */
const SIGNIFICANT_CLASS_MEMBERS: Readonly<Record<string, readonly string[]>> = {
  AppOpenAd: [
    'createForAdRequest',
    'load',
    'show',
    'addAdEventListener',
    'addAdEventsListener',
    'removeAllListeners',
    'destroy',
    'responseInfo',
  ],
  InterstitialAd: [
    'createForAdRequest',
    'load',
    'show',
    'addAdEventListener',
    'addAdEventsListener',
    'removeAllListeners',
    'destroy',
    'responseInfo',
  ],
  RewardedAd: [
    'createForAdRequest',
    'load',
    'show',
    'addAdEventListener',
    'addAdEventsListener',
    'removeAllListeners',
    'destroy',
    'responseInfo',
  ],
  RewardedInterstitialAd: [
    'createForAdRequest',
    'load',
    'show',
    'addAdEventListener',
    'addAdEventsListener',
    'removeAllListeners',
    'destroy',
    'responseInfo',
  ],
  GAMInterstitialAd: [
    'createForAdRequest',
    'load',
    'show',
    'addAdEventListener',
    'addAdEventsListener',
    'removeAllListeners',
    'destroy',
    'responseInfo',
  ],
  NativeAd: [
    'createForAdRequest',
    'addAdEventListener',
    'removeAllAdEventListeners',
    'destroy',
    'responseInfo',
  ],
  MultiFormatAdRequest: ['create', 'load', 'destroy'],
};

/** Factories whose call return type exposes MobileAds module methods. */
const MOBILE_ADS_FACTORY_EXPORTS = new Set(['MobileAds']);

const sourceDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(sourceDirectory, '../../..');
const coreTsconfigPath = path.join(repositoryRoot, 'packages/core/tsconfig.json');
const coreIndexPath = path.join(repositoryRoot, 'packages/core/src/index.ts');

function readCoreCompilerOptions(): ts.CompilerOptions {
  const config = ts.readConfigFile(coreTsconfigPath, ts.sys.readFile);
  if (config.error) {
    throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
  }
  return ts.parseJsonConfigFileContent(config.config, ts.sys, path.dirname(coreTsconfigPath)).options;
}

function aliasIsExplicitlyTypeOnly(symbol: ts.Symbol): boolean {
  return (symbol.declarations ?? []).some(declaration => {
    if (!ts.isExportSpecifier(declaration)) {
      return false;
    }
    return declaration.isTypeOnly || declaration.parent.parent.isTypeOnly;
  });
}

function resolvedSymbol(checker: ts.TypeChecker, symbol: ts.Symbol): ts.Symbol {
  return symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
}

function hasRuntimeValue(checker: ts.TypeChecker, symbol: ts.Symbol): boolean {
  return (
    !aliasIsExplicitlyTypeOnly(symbol) &&
    Boolean(resolvedSymbol(checker, symbol).flags & ts.SymbolFlags.Value)
  );
}

function isComponent(checker: ts.TypeChecker, symbol: ts.Symbol): boolean {
  const resolved = resolvedSymbol(checker, symbol);
  const declaredType = checker.getDeclaredTypeOfSymbol(resolved);
  if (declaredType.getProperty('render')) {
    return true;
  }
  const valueDeclaration = resolved.valueDeclaration ?? resolved.declarations?.[0];
  if (!valueDeclaration) {
    return false;
  }
  const valueType = checker.getTypeOfSymbolAtLocation(resolved, valueDeclaration);
  return valueType.getCallSignatures().some(signature => {
    const returnType = checker.typeToString(signature.getReturnType());
    return /(?:Element|ReactNode)/.test(returnType);
  });
}

function classifySymbol(
  checker: ts.TypeChecker,
  exportedName: string,
  symbol: ts.Symbol,
  runtime: boolean,
): PublicApiKind {
  if (!runtime) {
    return 'type-only';
  }
  if (exportedName.startsWith('use')) {
    return 'hook';
  }
  const resolved = resolvedSymbol(checker, symbol);
  if (isComponent(checker, symbol)) {
    return 'component';
  }
  const declaration = resolved.valueDeclaration ?? resolved.declarations?.[0];
  if (
    declaration &&
    checker.getTypeOfSymbolAtLocation(resolved, declaration).getCallSignatures().length > 0
  ) {
    return 'function';
  }
  if (resolved.flags & ts.SymbolFlags.Class) {
    return 'class';
  }
  if (resolved.flags & ts.SymbolFlags.Function) {
    return 'function';
  }
  if (declaration) {
    const valueType = checker.getTypeOfSymbolAtLocation(resolved, declaration);
    const members = checker.getPropertiesOfType(valueType);
    if (
      valueType.flags & ts.TypeFlags.Object &&
      members.some(member => {
        const memberDeclaration = member.valueDeclaration ?? member.declarations?.[0];
        return (
          memberDeclaration &&
          checker.getTypeOfSymbolAtLocation(member, memberDeclaration).getCallSignatures().length > 0
        );
      })
    ) {
      return 'namespace/object';
    }
  }
  return 'const/preset';
}

function toMember(
  checker: ts.TypeChecker,
  parentName: string,
  member: ts.Symbol,
): PublicApiMember {
  const memberName = `${parentName}.${member.getName()}`;
  return {
    name: memberName,
    kind: classifySymbol(checker, memberName, member, true),
    runtime: true as const,
  };
}

function enumerateObjectMembers(
  checker: ts.TypeChecker,
  exportedName: string,
  symbol: ts.Symbol,
  kind: PublicApiKind,
): PublicApiMember[] {
  if (kind !== 'namespace/object') {
    return [];
  }
  const resolved = resolvedSymbol(checker, symbol);
  const declaration = resolved.valueDeclaration ?? resolved.declarations?.[0];
  if (!declaration) {
    return [];
  }
  const valueType = checker.getTypeOfSymbolAtLocation(resolved, declaration);
  return checker
    .getPropertiesOfType(valueType)
    .filter(member => member.flags & ts.SymbolFlags.Value)
    .map(member => toMember(checker, exportedName, member))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function enumerateFactoryReturnMembers(
  checker: ts.TypeChecker,
  exportedName: string,
  symbol: ts.Symbol,
): PublicApiMember[] {
  if (!MOBILE_ADS_FACTORY_EXPORTS.has(exportedName)) {
    return [];
  }
  const resolved = resolvedSymbol(checker, symbol);
  const declaration = resolved.valueDeclaration ?? resolved.declarations?.[0];
  if (!declaration) {
    return [];
  }
  const valueType = checker.getTypeOfSymbolAtLocation(resolved, declaration);
  const returnType = valueType.getCallSignatures()[0]?.getReturnType();
  if (!returnType) {
    return [];
  }
  return checker
    .getPropertiesOfType(returnType)
    .filter(member => member.flags & ts.SymbolFlags.Value)
    .filter(member => !member.getName().startsWith('_'))
    .map(member => toMember(checker, exportedName, member))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function enumerateClassMembers(
  checker: ts.TypeChecker,
  exportedName: string,
  symbol: ts.Symbol,
  kind: PublicApiKind,
): PublicApiMember[] {
  if (kind !== 'class') {
    return [];
  }
  const allowlist = SIGNIFICANT_CLASS_MEMBERS[exportedName];
  if (!allowlist) {
    return [];
  }
  const allowed = new Set(allowlist);
  const resolved = resolvedSymbol(checker, symbol);
  const declaration = resolved.valueDeclaration ?? resolved.declarations?.[0];
  if (!declaration) {
    return [];
  }
  const ctorType = checker.getTypeOfSymbolAtLocation(resolved, declaration);
  const instanceType = checker.getDeclaredTypeOfSymbol(resolved);
  const byName = new Map<string, ts.Symbol>();
  for (const member of checker.getPropertiesOfType(ctorType)) {
    if (allowed.has(member.getName())) {
      byName.set(member.getName(), member);
    }
  }
  for (const member of checker.getPropertiesOfType(instanceType)) {
    if (allowed.has(member.getName())) {
      byName.set(member.getName(), member);
    }
  }
  const missing = allowlist.filter(name => !byName.has(name));
  if (missing.length > 0) {
    throw new Error(
      `Significant class members missing from ${exportedName} compiler surface: ${missing.join(', ')}`,
    );
  }
  return [...byName.values()]
    .map(member => toMember(checker, exportedName, member))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function resolveComponentPropsType(
  checker: ts.TypeChecker,
  symbol: ts.Symbol,
): ts.Type | undefined {
  const resolved = resolvedSymbol(checker, symbol);
  const declaration = resolved.valueDeclaration ?? resolved.declarations?.[0];
  if (!declaration) {
    return undefined;
  }
  const valueType = checker.getTypeOfSymbolAtLocation(resolved, declaration);
  for (const signature of valueType.getCallSignatures()) {
    const propsParameter = signature.getParameters()[0];
    if (propsParameter) {
      return checker.getTypeOfSymbolAtLocation(propsParameter, declaration);
    }
  }
  const instanceType = checker.getDeclaredTypeOfSymbol(resolved);
  const propsSymbol = instanceType.getProperty('props');
  if (propsSymbol) {
    const propsDeclaration = propsSymbol.valueDeclaration ?? propsSymbol.declarations?.[0];
    if (propsDeclaration) {
      return checker.getTypeOfSymbolAtLocation(propsSymbol, propsDeclaration);
    }
  }
  return undefined;
}

function enumerateComponentMembers(
  checker: ts.TypeChecker,
  exportedName: string,
  symbol: ts.Symbol,
  kind: PublicApiKind,
): PublicApiMember[] {
  if (kind !== 'component') {
    return [];
  }
  const propAllowlist = SIGNIFICANT_COMPONENT_PROPS[exportedName] ?? [];
  const methodAllowlist = SIGNIFICANT_COMPONENT_METHODS[exportedName] ?? [];
  if (propAllowlist.length === 0 && methodAllowlist.length === 0) {
    return [];
  }
  const members: PublicApiMember[] = [];
  const propsType = resolveComponentPropsType(checker, symbol);
  if (propsType && propAllowlist.length > 0) {
    const allowed = new Set(propAllowlist);
    const found = new Set<string>();
    for (const prop of checker.getPropertiesOfType(propsType)) {
      if (!allowed.has(prop.getName())) {
        continue;
      }
      found.add(prop.getName());
      members.push(toMember(checker, exportedName, prop));
    }
    const missing = propAllowlist.filter(name => !found.has(name));
    if (missing.length > 0) {
      throw new Error(
        `Significant component props missing from ${exportedName}: ${missing.join(', ')}`,
      );
    }
  }
  if (methodAllowlist.length > 0) {
    const resolved = resolvedSymbol(checker, symbol);
    const instanceType = checker.getDeclaredTypeOfSymbol(resolved);
    const allowed = new Set(methodAllowlist);
    const found = new Set<string>();
    for (const method of checker.getPropertiesOfType(instanceType)) {
      if (!allowed.has(method.getName())) {
        continue;
      }
      found.add(method.getName());
      members.push(toMember(checker, exportedName, method));
    }
    const missing = methodAllowlist.filter(name => !found.has(name));
    if (missing.length > 0) {
      throw new Error(
        `Significant component methods missing from ${exportedName}: ${missing.join(', ')}`,
      );
    }
  }
  return members.sort((left, right) => left.name.localeCompare(right.name));
}

function enumerateMembers(
  checker: ts.TypeChecker,
  exportedName: string,
  symbol: ts.Symbol,
  kind: PublicApiKind,
): PublicApiMember[] {
  const fromNamespace = enumerateObjectMembers(checker, exportedName, symbol, kind);
  const fromFactory = enumerateFactoryReturnMembers(checker, exportedName, symbol);
  const fromClass = enumerateClassMembers(checker, exportedName, symbol, kind);
  const fromComponent = enumerateComponentMembers(checker, exportedName, symbol, kind);
  return [...fromNamespace, ...fromFactory, ...fromClass, ...fromComponent].sort((left, right) =>
    left.name.localeCompare(right.name),
  );
}

export function derivePublicApiMatrix(): readonly PublicApiExport[] {
  const program = ts.createProgram([coreIndexPath], readCoreCompilerOptions());
  const diagnostics = ts.getPreEmitDiagnostics(program);
  if (diagnostics.length > 0) {
    throw new Error(
      ts.formatDiagnosticsWithColorAndContext(diagnostics, {
        getCanonicalFileName: fileName => fileName,
        getCurrentDirectory: () => repositoryRoot,
        getNewLine: () => '\n',
      }),
    );
  }
  const checker = program.getTypeChecker();
  const indexSource = program.getSourceFile(coreIndexPath);
  if (!indexSource) {
    throw new Error(`TypeScript program did not include ${coreIndexPath}`);
  }
  const indexSymbol = checker.getSymbolAtLocation(indexSource);
  if (!indexSymbol) {
    throw new Error(`TypeScript checker did not resolve ${coreIndexPath}`);
  }
  const matrix = checker
    .getExportsOfModule(indexSymbol)
    .map(symbol => {
      const runtime = hasRuntimeValue(checker, symbol);
      const kind = classifySymbol(checker, symbol.getName(), symbol, runtime);
      return {
        name: symbol.getName(),
        kind,
        runtime,
        partition: 'product' as const,
        members: runtime ? enumerateMembers(checker, symbol.getName(), symbol, kind) : [],
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));

  for (const probe of EXAMPLE_PROBE_SURFACES) {
    if (matrix.some(entry => entry.name === probe.id || entry.members.some(m => m.name === probe.id))) {
      throw new Error(
        `Example probe ${probe.id} leaked into the product public API matrix; keep probes partitioned.`,
      );
    }
  }
  return matrix;
}

export function productRuntimeBehaviors(
  matrix: readonly PublicApiExport[] = derivePublicApiMatrix(),
): ReadonlyMap<string, PublicApiKind> {
  const behaviors = new Map<string, PublicApiKind>();
  for (const exported of matrix) {
    if (exported.partition !== 'product' || !exported.runtime) {
      continue;
    }
    behaviors.set(exported.name, exported.kind);
    for (const member of exported.members) {
      behaviors.set(member.name, member.kind);
    }
  }
  return behaviors;
}
