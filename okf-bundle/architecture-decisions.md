---
type: Reference
title: Architecture decisions (ADR)
description: Canonical owner of durable GMA product and tooling decisions.
tags: [okf, adr]
timestamp: 2026-08-22T00:00:00Z
---

# Architecture decisions (ADR)

**Canonical owner** of durable “what + why” decisions for this repo. Procedures and commands live in [testing](testing/index.md). Do not duplicate these decisions into ephemeral session trackers.

**Policy:** [OKF documentation policy](documentation-policy.md).

## Decision ID convention

Cite decisions as **`GMA-AD-<n>`**.

## Status legend

| Status | Meaning |
|--------|---------|
| **Accepted** | Decided; follow this. |
| **Proposed** | Planned; not yet the rule. |
| **Rejected** | Considered and declined; keep so it is not re-litigated. |

Add rows when a refactor choice lands (module boundaries, codegen, plugin behavior, native backend). Do not paste decisions from other repos.

<a id="gma-ad-1"></a>

## GMA-AD-1 — Expo config plugin is a separate validation path — **Accepted**

The Expo config plugin under `packages/core/plugin/` is a **separate validation path**: Metro/Expo consume compiled plugin output, not `packages/core/plugin/src/`. Native e2e does not cover plugin JS/config by itself.

Commands: [validation checklist § Expo plugin](testing/validation-checklist.md#expo-plugin) (root Jest is the gate). When to run e2e vs plugin Jest: [running e2e § platform coverage](testing/running-e2e.md#platform-coverage-gate-blocking).

<a id="gma-ad-2"></a>

## GMA-AD-2 — Yarn workspaces + Lerna/Nx prepare — **Accepted**

This repo is a **Yarn 4 workspaces** monorepo. The core npm package
`react-native-google-mobile-ads` lives in `packages/core/`; public scoped mediation
adapters live in `packages/{applovin,facebook,inmobi,mintegral,moloco,pangle,unity,vungle,yandex}/`.
semantic-release versions core plus all public adapters in lockstep; the publish
workflow's convergent `lerna publish from-package` step is the only npm uploader
([CI publish convergence](ci-workflows/index.md#publish-podfile-lock)).
`packages/_template/` is a private scaffold and is never published. The example app
stays at `RNGoogleMobileAdsExample/` and depends on the core package via the workspace
protocol (not `portal:`).

Root `yarn prepare` runs `yarn lerna:prepare` (Lerna 9 + Nx cache, `neverConnectToCloud`). Per-package `prepare` performs genversion, bob (`lib/`), and the Expo plugin build. Do not invent a second task runner.

Package TypeScript extends root `tsconfig.packages.base.json`. Root `eslint.config.js` is the shared flat ESLint config for workspace packages (`tooling/*` will reuse it when lint is wired for that tree). Private Appium harness: `@invertase/rngma-appium` under `tooling/appium/` ([Appium](testing/running-e2e.md#appium-scaffold)). Core publishes explicit `exports` where `react-native`, `source`, `import`, and `require` each nest `types` (`react-native` / `source` / `import` → `./lib/typescript/module/index.d.ts`; `require` → `./lib/typescript/commonjs/index.d.ts`); `react-native` and `source` `default` → `./src/index.ts`; `import`/`require` `default` → dual Bob JS; bare `default` → CJS. Bob `esm` dual build under `lib/commonjs`, `lib/module`, and `lib/typescript/{commonjs,module}`.

Commands: [agent command policy](testing/agent-command-policy.md). Product trees: [change authoring](testing/change-authoring-workflow.md).

<a id="gma-ad-3"></a>

## GMA-AD-3 — Commit library Codegen — **Accepted**

`packages/core` ships React Native Codegen output as package source. Its
`codegenConfig.includesGeneratedCode` is `true`; Android artifacts live under
`packages/core/android/generated/` and iOS artifacts under
`packages/core/ios/generated/`. Gradle, CocoaPods, and Android autolinking
consume those package-owned trees, so consumer builds do not regenerate core
library code.

Generation uses the example-owned React Native toolchain ([GMA-AD-4](#gma-ad-4))
with `--source library`
and always wipes a platform output tree before writing it. Generated files are
committed, published by the package's existing `android/` and `ios/` file
entries, and excluded from handwritten-source formatting. Do not hand-edit
them. Handwritten-file whitespace and diff checks explicitly exclude both
generated trees; `yarn codegen:verify` owns their generated-byte integrity. The
verification command first requires both trees to contain tracked
index entries, then regenerates them and rejects tracked drift, deletions, and
untracked extras only under those two paths.

This decision applies only to the core library. The example app and its
example-only `@invertase/rngma-testing` probe do not set
`includesGeneratedCode`; their app-level artifacts remain build-time and
uncommitted. Routine e2e performs the separate app-source iOS generation needed
before CocoaPods, while Android Gradle continues to generate app/probe metadata
during its build. Commands: [agent command policy](testing/agent-command-policy.md).

<a id="gma-ad-4"></a>

## GMA-AD-4 — Pin the Codegen toolchain — **Accepted**

The React Native line of `RNGoogleMobileAdsExample/` owns core library Codegen.
The example pins `react-native` and `@react-native/codegen` to the committed
React Native line, and pins the `@react-native-community/cli` family used by
generation and example launch — `cli`, `cli-platform-android`, and
`cli-platform-ios` — to exact **20.2.0**. The shared runner resolves that
workspace toolchain, verifies every pin at runtime (declared and resolved),
then uses React Native's generator. Root and package manifests must not
provide a competing React Native toolchain or use floating toolchain ranges.
Core and adapter peer dependencies must expose the same React Native minimum
as the committed template line.

Committed Codegen is React-Native-version-specific. Updating the example's
React Native line is one coordinated breaking change: update all compatible
example and root React Native tooling pins, wipe and regenerate both committed
core trees, run `codegen:self-check` and `codegen:verify`, and rebuild/test both
native platforms.

A **CLI-only patch** of that 20.2 family is not a React Native line change:
update the example pins, lockfile, and exact self-check/verify assertions to
the new patch, then run `codegen:self-check` and `codegen:verify`. Regenerate
committed core output only when that verification finds drift. Do not wipe
and rewrite the trees as a ritual when verify is already clean.

CI runs `codegen:verify`; routine e2e consumes the committed core trees and
generates only example/probe app-source metadata. Commands:
[agent command policy](testing/agent-command-policy.md).

The generated directories remain package source and must never be patched by
hand. CocoaPods preserves their package-local header layout, and the npm
package's existing `android/` and `ios/` entries publish both trees.
