/**
 * Cross-package product surfaces outside the core barrel.
 * Scoped mediation adapters + Expo plugins must be dispositioned fail-closed.
 * Private `packages/_template` is intentionally omitted (not published).
 *
 * Published adapter roster and plugin/JS members are derived from the packages
 * tree (package.json + source barrels). A new published adapter without a
 * disposition row fails validate until a maintainer adds one.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

export type PackageSurfaceKind = 'adapter-js' | 'adapter-plugin' | 'core-plugin';

export type PackageSurfaceDisposition =
  | 'jest-owned'
  | 'plugin-fixture-pending'
  | 'lower-layer-only';

export type PackageSurfaceContract = {
  id: string;
  packageName: string;
  surface: PackageSurfaceKind;
  partition: 'product';
  members: readonly string[];
  disposition: PackageSurfaceDisposition;
  reason: string;
};

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const packagesRoot = path.join(repositoryRoot, 'packages');
const ADAPTER_SCOPE = '@react-native-google-mobile-ads/';

type PublishedAdapter = {
  slug: string;
  packageName: string;
  packageDir: string;
};

/** Non-private packages under `packages/` scoped as public adapters. */
export function discoverPublishedAdapters(
  root: string = packagesRoot,
): readonly PublishedAdapter[] {
  const adapters: PublishedAdapter[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) {
      continue;
    }
    const packageJsonPath = path.join(root, entry.name, 'package.json');
    if (!existsSync(packageJsonPath)) {
      continue;
    }
    const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
      name?: string;
      private?: boolean;
    };
    if (pkg.private === true || typeof pkg.name !== 'string') {
      continue;
    }
    if (!pkg.name.startsWith(ADAPTER_SCOPE)) {
      continue;
    }
    const slug = pkg.name.slice(ADAPTER_SCOPE.length);
    if (!slug || slug.includes('/')) {
      continue;
    }
    adapters.push({
      slug,
      packageName: pkg.name,
      packageDir: path.join(root, entry.name),
    });
  }
  return adapters.sort((left, right) => left.slug.localeCompare(right.slug));
}

function hasExportKeyword(modifiers: ts.NodeArray<ts.ModifierLike> | undefined): boolean {
  return modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword) ?? false;
}

function hasDefaultKeyword(modifiers: ts.NodeArray<ts.ModifierLike> | undefined): boolean {
  return modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.DefaultKeyword) ?? false;
}

/** Value exports (including default) from a TS barrel; type-only exports omitted. */
export function listValueExportsFromSource(sourcePath: string): readonly string[] {
  const sourceText = readFileSync(sourcePath, 'utf8');
  const sourceFile = ts.createSourceFile(
    sourcePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const names = new Set<string>();

  for (const statement of sourceFile.statements) {
    if (ts.isExportAssignment(statement) && !statement.isExportEquals) {
      names.add('default');
      continue;
    }

    if (ts.isTypeAliasDeclaration(statement) || ts.isInterfaceDeclaration(statement)) {
      continue;
    }

    if (
      (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) &&
      hasExportKeyword(statement.modifiers)
    ) {
      if (hasDefaultKeyword(statement.modifiers)) {
        names.add('default');
      } else if (statement.name) {
        names.add(statement.name.text);
      }
      continue;
    }

    if (ts.isVariableStatement(statement) && hasExportKeyword(statement.modifiers)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) {
          names.add(declaration.name.text);
        }
      }
      continue;
    }

    if (ts.isExportDeclaration(statement)) {
      if (statement.isTypeOnly) {
        continue;
      }
      if (statement.exportClause && ts.isNamedExports(statement.exportClause)) {
        for (const element of statement.exportClause.elements) {
          if (!element.isTypeOnly) {
            names.add(element.name.text);
          }
        }
      }
    }
  }

  return [...names].sort((left, right) => left.localeCompare(right));
}

function adapterJsMembers(adapter: PublishedAdapter): readonly string[] {
  const indexPath = path.join(adapter.packageDir, 'src', 'index.ts');
  return listValueExportsFromSource(indexPath);
}

function adapterPluginMembers(adapter: PublishedAdapter): readonly string[] {
  const indexPath = path.join(adapter.packageDir, 'plugin', 'src', 'index.ts');
  return listValueExportsFromSource(indexPath);
}

function corePluginMembers(): readonly string[] {
  return listValueExportsFromSource(
    path.join(packagesRoot, 'core', 'plugin', 'src', 'index.ts'),
  );
}

type SurfaceMeta = {
  disposition: PackageSurfaceDisposition;
  reason: string;
};

const CONSTANT_ADAPTER_REASON =
  'Adapter JS surface is networkSlug + nativeAdapterClassName constants locked by package Jest; no independent Appium outcome (real mediation fill is not claimed as Appium success).';

const DEFAULT_PLUGIN_PENDING_REASON =
  'Adapter Expo plugin SKAdNetwork merge has no checked-in fixtures yet; default-only barrel (no KNOWN_PLUGIN_PARAMETER_KEYS). Fixture roll-out remains open work, not an accepted campaign exception.';

/** Disposition/reason rows keyed by surface id. Members come from the package tree. */
const SURFACE_META: Readonly<Record<string, SurfaceMeta>> = {
  'react-native-google-mobile-ads#plugin': {
    disposition: 'jest-owned',
    reason:
      'Core Expo config plugin is covered by packages/core/plugin/__tests__ fixtures and Jest; Appium does not exercise Expo prebuild.',
  },
  '@react-native-google-mobile-ads/applovin#js': {
    disposition: 'jest-owned',
    reason: CONSTANT_ADAPTER_REASON,
  },
  '@react-native-google-mobile-ads/facebook#js': {
    disposition: 'jest-owned',
    reason:
      'Facebook adapter Jest locks constants plus privacy pre-init forwards (setAdvertiserTrackingEnabled / setDataProcessingOptions); no Appium privacy UI outcome.',
  },
  '@react-native-google-mobile-ads/inmobi#js': {
    disposition: 'jest-owned',
    reason: CONSTANT_ADAPTER_REASON,
  },
  '@react-native-google-mobile-ads/mintegral#js': {
    disposition: 'jest-owned',
    reason: CONSTANT_ADAPTER_REASON,
  },
  '@react-native-google-mobile-ads/moloco#js': {
    disposition: 'jest-owned',
    reason: CONSTANT_ADAPTER_REASON,
  },
  '@react-native-google-mobile-ads/pangle#js': {
    disposition: 'jest-owned',
    reason: CONSTANT_ADAPTER_REASON,
  },
  '@react-native-google-mobile-ads/unity#js': {
    disposition: 'jest-owned',
    reason: CONSTANT_ADAPTER_REASON,
  },
  '@react-native-google-mobile-ads/vungle#js': {
    disposition: 'jest-owned',
    reason: CONSTANT_ADAPTER_REASON,
  },
  '@react-native-google-mobile-ads/yandex#js': {
    disposition: 'jest-owned',
    reason:
      'Yandex adapter Jest locks networkSlug and iOS custom-event class map (android null); no Appium mediation-fill outcome.',
  },
  '@react-native-google-mobile-ads/applovin#plugin': {
    disposition: 'plugin-fixture-pending',
    reason: DEFAULT_PLUGIN_PENDING_REASON,
  },
  '@react-native-google-mobile-ads/facebook#plugin': {
    disposition: 'jest-owned',
    reason:
      'Facebook adapter plugin Jest covers unknown-parameter warnings and exported warnUnknownPluginParameters; apply/fixture depth still thinner than core plugin.',
  },
  '@react-native-google-mobile-ads/inmobi#plugin': {
    disposition: 'plugin-fixture-pending',
    reason: DEFAULT_PLUGIN_PENDING_REASON,
  },
  '@react-native-google-mobile-ads/mintegral#plugin': {
    disposition: 'plugin-fixture-pending',
    reason: DEFAULT_PLUGIN_PENDING_REASON,
  },
  '@react-native-google-mobile-ads/moloco#plugin': {
    disposition: 'plugin-fixture-pending',
    reason: DEFAULT_PLUGIN_PENDING_REASON,
  },
  '@react-native-google-mobile-ads/pangle#plugin': {
    disposition: 'plugin-fixture-pending',
    reason: DEFAULT_PLUGIN_PENDING_REASON,
  },
  '@react-native-google-mobile-ads/unity#plugin': {
    disposition: 'plugin-fixture-pending',
    reason: DEFAULT_PLUGIN_PENDING_REASON,
  },
  '@react-native-google-mobile-ads/vungle#plugin': {
    disposition: 'plugin-fixture-pending',
    reason: DEFAULT_PLUGIN_PENDING_REASON,
  },
  '@react-native-google-mobile-ads/yandex#plugin': {
    disposition: 'plugin-fixture-pending',
    reason: DEFAULT_PLUGIN_PENDING_REASON,
  },
};

function buildPackageSurfaceContracts(): readonly PackageSurfaceContract[] {
  const adapters = discoverPublishedAdapters();
  const contracts: PackageSurfaceContract[] = [];

  const coreMeta = SURFACE_META['react-native-google-mobile-ads#plugin'];
  if (coreMeta) {
    contracts.push({
      id: 'react-native-google-mobile-ads#plugin',
      packageName: 'react-native-google-mobile-ads',
      surface: 'core-plugin',
      partition: 'product',
      members: corePluginMembers(),
      disposition: coreMeta.disposition,
      reason: coreMeta.reason,
    });
  }

  for (const adapter of adapters) {
    const jsId = `${adapter.packageName}#js`;
    const pluginId = `${adapter.packageName}#plugin`;
    const jsMeta = SURFACE_META[jsId];
    const pluginMeta = SURFACE_META[pluginId];
    // Missing SURFACE_META rows are omitted here; validatePackageSurfaceContracts fails closed.
    if (jsMeta) {
      contracts.push({
        id: jsId,
        packageName: adapter.packageName,
        surface: 'adapter-js',
        partition: 'product',
        members: adapterJsMembers(adapter),
        disposition: jsMeta.disposition,
        reason: jsMeta.reason,
      });
    }
    if (pluginMeta) {
      contracts.push({
        id: pluginId,
        packageName: adapter.packageName,
        surface: 'adapter-plugin',
        partition: 'product',
        members: adapterPluginMembers(adapter),
        disposition: pluginMeta.disposition,
        reason: pluginMeta.reason,
      });
    }
  }

  return contracts.sort((left, right) => left.id.localeCompare(right.id));
}

export const PACKAGE_SURFACE_CONTRACTS: readonly PackageSurfaceContract[] =
  buildPackageSurfaceContracts();

function sortedEqual(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }
  return true;
}

export function validatePackageSurfaceContracts(
  contracts: readonly PackageSurfaceContract[] = PACKAGE_SURFACE_CONTRACTS,
): string[] {
  const errors: string[] = [];
  const byId = new Map<string, PackageSurfaceContract>();
  const adapters = discoverPublishedAdapters();
  const expectedIds = new Set<string>([
    'react-native-google-mobile-ads#plugin',
    ...adapters.flatMap(adapter => [
      `${adapter.packageName}#js`,
      `${adapter.packageName}#plugin`,
    ]),
  ]);

  const expectedMembers = new Map<string, readonly string[]>();
  expectedMembers.set('react-native-google-mobile-ads#plugin', corePluginMembers());
  for (const adapter of adapters) {
    expectedMembers.set(`${adapter.packageName}#js`, adapterJsMembers(adapter));
    expectedMembers.set(`${adapter.packageName}#plugin`, adapterPluginMembers(adapter));
  }

  for (const contract of contracts) {
    if (byId.has(contract.id)) {
      errors.push(`duplicate package surface disposition for ${contract.id}`);
      continue;
    }
    byId.set(contract.id, contract);
    if (contract.partition !== 'product') {
      errors.push(`package surface ${contract.id} must be product-partitioned`);
    }
    if (contract.members.length === 0) {
      errors.push(`package surface ${contract.id} has no members`);
    }
    if (
      contract.reason.trim().split(/\s+/).length < 10 ||
      /\b(?:hard to test|difficult to test|not testable|n\/a|todo)\b/i.test(contract.reason)
    ) {
      errors.push(
        `${contract.disposition} ${contract.id} has a missing or non-specific reason`,
      );
    }
    const discovered = expectedMembers.get(contract.id);
    if (discovered && !sortedEqual([...contract.members].sort(), [...discovered].sort())) {
      errors.push(
        `package surface ${contract.id} members [${contract.members.join(', ')}] do not match published barrel exports [${discovered.join(', ')}]`,
      );
    }
  }

  for (const id of expectedIds) {
    if (!byId.has(id)) {
      errors.push(`published package surface ${id} has no disposition`);
    }
  }
  for (const id of byId.keys()) {
    if (!expectedIds.has(id)) {
      errors.push(`registry references unexpected package surface ${id}`);
    }
  }
  for (const id of Object.keys(SURFACE_META)) {
    if (!expectedIds.has(id)) {
      errors.push(`SURFACE_META references unpublished or unknown package surface ${id}`);
    }
  }
  return errors;
}

export function packageSurfaceSummary(
  contracts: readonly PackageSurfaceContract[] = PACKAGE_SURFACE_CONTRACTS,
): Record<PackageSurfaceDisposition, number> {
  const summary: Record<PackageSurfaceDisposition, number> = {
    'jest-owned': 0,
    'plugin-fixture-pending': 0,
    'lower-layer-only': 0,
  };
  for (const contract of contracts) {
    summary[contract.disposition] += 1;
  }
  return summary;
}
