---
type: Reference
title: Running e2e tests
description: Canonical e2e yarn tests:* commands.
tags: [testing, e2e, ios, android]
timestamp: 2026-08-22T00:00:00Z
---

# Running e2e tests

<a id="agent-rule-read-first"></a>

## Agent rule

Use **only** these scripts. No direct Jet/Metro/Gradle/`pod`. Install: [agent command policy](agent-command-policy.md).

Once: `yarn && yarn prepare && yarn tests:install` (+ `yarn tests:ios:pod:install` on iOS).

```bash
yarn tests:packager                 # reset: tests:packager:reset-cache
yarn tests:android:build && yarn tests:android:run
yarn tests:ios:pod:install && yarn tests:ios:run
```

Specs: `e2e/*.e2e.js`. App: `RNGoogleMobileAdsExample/`. Logs: `/tmp/rngma-e2e-android.log`, `/tmp/rngma-e2e-ios.log`. One e2e at a time (`:8081`). No source edits during a run.

JS-only `src/`: `yarn prepare` + packager reset; native `:build` not required. Native/codegen/plugin: rebuild then run.

<a id="platform-coverage-gate-blocking"></a>

## Platform coverage gate

Touched `android/**`, `ios/**`, plugin native config, podspec, or `src/specs/**` → e2e on **each affected platform** before impl/review gates. No macOS e2e script.

A green run of **unrelated** e2e files does not close review for the touched area. **full** = both platforms when native/plugin/example wiring changed.

<a id="pre-flight"></a>

## Pre-flight

**Blocking.** [Prepare must finish first](agent-command-policy.md#prepare-must-finish-first): `yarn prepare` exit 0 before Metro/e2e when `src/` or `plugin/` changed (or `lib/` is stale). Do not parallelize prepare with packager, Jest, Gradle, or pods.

Metro on `:8081` must be **this** checkout (`RNGoogleMobileAdsExample/`), not another worktree. One e2e at a time. Free `:8081` before `yarn tests:packager:reset-cache`. Revert `.only` before area-focused/full.

Interrupted Shell: log footer `N passing`/`N failing` = complete. An open tee or missing footer is **not** success — recover Metro `:8081` and re-run the **same** command.

<a id="e2e-diagnosis"></a>

## Diagnosis

1. Confirm [pre-flight](#pre-flight).
2. Same failure twice on the canonical command → narrow to one file or `.only` (`unit-focused` only).
3. Read `/tmp/rngma-e2e-ios.log` / `/tmp/rngma-e2e-android.log` (CI: `simulator_log` / `adb_logs` — [CI workflows](../ci-workflows/index.md)).
4. Revert `.only` and extra native logging before area-focused review or commit.

Do not invent harness override files or debug flags from other repos.

Merge: no `.only`; **full** = Jest coverage + `lint:code` + tsc + both platforms if native/example wiring changed.
