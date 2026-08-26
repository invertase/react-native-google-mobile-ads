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

This repo is a **Yarn 4 workspaces** monorepo. The publishable npm package `react-native-google-mobile-ads` lives in `packages/core/`. The example app stays at `RNGoogleMobileAdsExample/` and depends on the core package via the workspace protocol (not `portal:`).

Root `yarn prepare` runs `yarn lerna:prepare` (Lerna 9 + Nx cache, `neverConnectToCloud`). Per-package `prepare` performs genversion, bob (`lib/`), and the Expo plugin build. Do not invent a second task runner.

Package TypeScript extends root `tsconfig.packages.base.json`. Root `eslint.config.js` is the shared flat ESLint config for workspace packages (future `tooling/*` should reuse it). Core publishes explicit `exports` where `react-native`, `source`, `import`, and `require` each nest `types` (`react-native` / `source` / `import` → `./lib/typescript/module/index.d.ts`; `require` → `./lib/typescript/commonjs/index.d.ts`); `react-native` and `source` `default` → `./src/index.ts`; `import`/`require` `default` → dual Bob JS; bare `default` → CJS. Bob `esm` dual build under `lib/commonjs`, `lib/module`, and `lib/typescript/{commonjs,module}`.

Commands: [agent command policy](testing/agent-command-policy.md). Product trees: [change authoring](testing/change-authoring-workflow.md).
