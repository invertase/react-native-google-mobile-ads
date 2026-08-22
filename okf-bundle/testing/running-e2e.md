---
type: Reference
title: Running e2e tests
description: Canonical local e2e yarn scripts (exact names).
tags: [testing, e2e, ios, android]
timestamp: 2026-08-22T00:00:00Z
---

# Running e2e tests

<a id="agent-rule-read-first"></a>

## Agent rule

Use **only** [local e2e commands](#local-e2e-commands). No direct Jet/Metro/Gradle/`pod`. Install: [agent command policy](agent-command-policy.md). When to run e2e vs Jest: [§ platform coverage](#platform-coverage-gate-blocking).

Once: `yarn && yarn prepare && yarn tests:install` (+ `yarn tests:ios:pod:install` on iOS).

<a id="local-e2e-commands"></a>

## Local e2e commands

**Names only.** Which of these to run is [platform coverage](#platform-coverage-gate-blocking). When running e2e, use only these named scripts (no `yarn tests:android:*` / `yarn tests:ios:*` globs). Do **not** run every named script unless that table requires it.

Named scripts: `yarn tests:packager`, `yarn tests:packager:reset-cache`, `yarn tests:android:build`, `yarn tests:android:run`, `yarn tests:ios:pod:install`, `yarn tests:ios:run`.

When those named scripts are the e2e gate, `tee` `yarn tests:android:run` to `/tmp/rngma-e2e-android.log` and `yarn tests:ios:run` to `/tmp/rngma-e2e-ios.log`. Redirect/`tee` of the **same** named yarn script is allowed; do not add other wrappers.

Specs: `e2e/*.e2e.js`. App: `RNGoogleMobileAdsExample/`. One e2e at a time (`:8081`). No source edits during a run.

There is no separate macOS-app e2e target. iOS e2e is `yarn tests:ios:pod:install` / `yarn tests:ios:run` (local Mac or CI `macos-15`).

A green GitHub Actions e2e workflow is **not** a pass ([continue-on-error](../ci-workflows/index.md#e2e-continue-on-error)). Use local counts + `/tmp/rngma-e2e-*.log`, or triaged `simulator_log` / `adb_logs`.

<a id="platform-coverage-gate-blocking"></a>

## Platform coverage gate

**Owner for which e2e/Jest this diff needs.** Lint/tsc: [lint-by-tree](validation-checklist.md#lint-and-formatting) and [evidence](validation-checklist.md#validation-evidence-package). Other docs hop here. Apply **every matching row**. JS-only `src/` does not apply if `src/specs/**`, `android/**`, or `ios/**` also changed.

| Diff | Required before impl/review gates |
|------|-----------------------------------|
| Docs/md/OKF only (`docs/**`, `**/*.md`, `okf-bundle/**`, `AGENTS.md`, `CONTRIBUTING.md`; no product trees) | No e2e. |
| Root `__tests__/` only | Root `yarn tests:jest` (paths as needed). **Not** native e2e. |
| JS-only `src/` excluding `src/specs/**` | `yarn prepare` + root Jest. Packager only if you will actually start Metro; JS-only does not require it. **Not** native e2e. |
| JS/config plugin only (`plugin/**`, `app.plugin.js`; no native-manifest/plist output) | [GMA-AD-1](../architecture-decisions.md#gma-ad-1) + [Expo plugin](validation-checklist.md#expo-plugin). Not native e2e. |
| Touched `e2e/**` | Android: `yarn tests:packager` (or `:reset-cache` when [pre-flight](#pre-flight) says free `:8081`) + `yarn tests:android:build` + `yarn tests:android:run`. iOS: `yarn tests:packager` (same reset) + `yarn tests:ios:pod:install` + `yarn tests:ios:run`. Specs that changed, on the platform(s) those specs exercise. [Tee](#local-e2e-commands). |
| `RNGoogleMobileAdsExample/**` (example app/config, not `node_modules`) | Android: `yarn tests:packager` (or `:reset-cache` when [pre-flight](#pre-flight) says free `:8081`) + `yarn tests:android:build` + `yarn tests:android:run`. iOS: `yarn tests:packager` (same reset) + `yarn tests:ios:pod:install` + `yarn tests:ios:run`. Each platform the example change can affect. [Tee](#local-e2e-commands). |
| Plugin output that changes native manifests/plists, or touched `android/**`, `ios/**`, podspec, or `src/specs/**` | Android: `yarn tests:packager` (or `:reset-cache` when [pre-flight](#pre-flight) says free `:8081`) + `yarn tests:android:build` + `yarn tests:android:run`. iOS: `yarn tests:packager` (same reset) + `yarn tests:ios:pod:install` + `yarn tests:ios:run`. **Each affected platform.** [Tee](#local-e2e-commands). |

A green run of **unrelated** e2e files does not close review for the touched area.

`full` / `pre-merge-validation`: [validation-checklist work types](validation-checklist.md#work-types) (this table **and** lint-by-tree / evidence for this diff). CI e2e jobs are not the pass signal ([continue-on-error](../ci-workflows/index.md#e2e-continue-on-error)).

<a id="pre-flight"></a>

## Pre-flight

**Blocking.** [Prepare must finish first](agent-command-policy.md#prepare-must-finish-first): `yarn` then `yarn prepare` before Metro/e2e (this pass runs Metro/native). Do not parallelize prepare with packager, Jest, Gradle, or pods. What to record stays on the [evidence prepare row](validation-checklist.md#validation-evidence-package).

Metro on `:8081` must be **this** checkout (`RNGoogleMobileAdsExample/`), not another worktree. One e2e at a time. Free `:8081` before `yarn tests:packager:reset-cache`. Revert `.only` before area-focused/full.

Interrupted Shell: log footer `N passing`/`N failing` = complete. An open tee or missing footer is **not** success — recover Metro `:8081` and re-run the **same** command.

<a id="e2e-diagnosis"></a>

## Diagnosis

1. Confirm [pre-flight](#pre-flight).
2. Same failure twice on the canonical command → narrow to one file or `.only` (`unit-focused` only).
3. Read `/tmp/rngma-e2e-ios.log` / `/tmp/rngma-e2e-android.log` (CI: `simulator_log` / `adb_logs` — [CI workflows](../ci-workflows/index.md)).
4. Revert `.only` and extra native logging before area-focused review or commit.

Do not invent harness override files or debug flags from other repos.

Merge: no `.only`. Pre-merge validation: [platform coverage](#platform-coverage-gate-blocking) for this diff (CI e2e not the pass) **and** the lint/tsc/coverage rows that [validation evidence](validation-checklist.md#validation-evidence-package) / [lint-by-tree](validation-checklist.md#lint-and-formatting) already require for this diff.
