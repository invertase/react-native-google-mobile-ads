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

Use **only** [local e2e commands](#local-e2e-commands). No direct Appium/Metro/Gradle/`pod` outside named scripts. Install: [agent command policy](agent-command-policy.md). When to run e2e vs Jest: [§ platform coverage](#platform-coverage-gate-blocking).

Once: `yarn && yarn prepare` (+ `yarn tests:ios:pod:install` on iOS). `yarn tests:install` is an alias for root `yarn` (workspaces).

<a id="local-e2e-commands"></a>

## Local e2e commands

**Names only.** Which of these to run is [platform coverage](#platform-coverage-gate-blocking). When running e2e, use only these named scripts (no `yarn tests:android:*` / `yarn tests:ios:*` globs). Do **not** run every named script unless that table requires it.

Named scripts: `yarn tests:packager`, `yarn tests:packager:reset-cache`, `yarn tests:android:build`, `yarn tests:android:run`, `yarn tests:ios:pod:install`, `yarn tests:ios:run`, `yarn tests:appium:android`, `yarn tests:appium:ios`.

When those named scripts are the e2e gate, `tee` `yarn tests:appium:android` to a unique `/tmp/rngma-e2e-android-*.log` and `yarn tests:appium:ios` to a unique `/tmp/rngma-e2e-ios-*.log`. Redirect/`tee` of the **same** named yarn script is allowed; do not add other wrappers.

Device driver: Appium 3 + WebdriverIO in `tooling/appium/` ([§ Appium](#appium-scaffold)). Specs: `tooling/appium/test/specs/**/*.ts`. App: `RNGoogleMobileAdsExample/` (format gallery + stable `testID`s). One e2e at a time (`:8081`). No source edits during a run.

There is no separate macOS-app e2e target. iOS e2e is `yarn tests:ios:pod:install` / `yarn tests:ios:run` (install) then `yarn tests:appium:ios` (local Mac or CI `macos-15`).

A green GitHub Actions e2e workflow is **not** a pass ([continue-on-error](../ci-workflows/index.md#e2e-continue-on-error)). Use local counts + `/tmp/rngma-e2e-*.log`, or triaged `simulator_log` / `adb_logs`.

<a id="appium-scaffold"></a>

## Appium

Private workspace `@invertase/rngma-appium` at `tooling/appium/` (Yarn workspace `tooling/*`; not a Lerna publish package). Stack: Appium 3 + WebdriverIO + UiAutomator2 + XCUITest. Focused smoke samples the gallery: representative **Banner** + **Collapsible Banner**, listed GAM banner sizes (**AnchoredAdaptiveBanner**, **Fluid**), plus interstitial / rewarded / rewarded interstitial / app open / native / GAM interstitial, and hooks / consent / inspector / debug seams. Remaining banner size variants stay reachable via the gallery accordion (manual QA); smoke does not open every size. Uses Google `TestIds` only — **no mediation**, no live-fill assertions (open each sample and assert its container; do not wait on auction).

**Session split:** Device smoke runs as **three** WDIO sessions (`formats.smoke.a-primary` / `b-secondary` / `c-tertiary`, lists in `tooling/appium/src/formats.ts`). Android UiAutomator2 tends to destabilize after roughly fifteen tests in one session; the split keeps each session shorter. iOS uses the same three-spec layout for parity.

**Pins:** JS deps in `tooling/appium/package.json` + `yarn.lock`. Driver versions are **also** pinned in checked-in `tooling/appium/drivers.manifest.json` (Appium drivers are not fully guaranteed by the lockfile alone). Install into gitignored `tooling/appium/.appium-home/` (`APPIUM_HOME`) with `yarn tests:appium:drivers:install`, then `yarn tests:appium:drivers:verify`. Device-free config check: `yarn tests:appium:validate`. Device runs: `yarn tests:appium:android` / `yarn tests:appium:ios`. Example UI uses stable `testID`s from `RNGoogleMobileAdsExample/src/appiumTestIds.ts` (mirrored in `tooling/appium/src/testIds.ts`).

**Probe TurboModule (Pattern C):** Example-only `@invertase/rngma-testing` (`portal:./modules/rngma-testing`) exposes `NativeRNGMATesting` (codegen + Android/iOS). Seed seams for delayed banner attach, debug inventory TTL, and ResponseInfo fixture JSON — not product package code. Debug gallery entry `gma.format.native-rngma-testing` exercises `ping()` and the fixtures; tertiary Appium smoke opens it and asserts `action.loaded` contains `ok ping=`. Use Yarn `portal:` (not `file:`) so native edits stay linked into `node_modules`. On a virgin iOS tree, if `<ReactCodegen/RNGMATestingSpec/…>` headers are missing after the first codegen, re-run `yarn tests:ios:pod:install` once so Public headers land, then `yarn tests:ios:run`.

**Gallery sections:** The example home screen filters with **All | Formats | Hooks | Debug** chips (`gma.gallery.section.*`). Appium helpers select the section that contains a format before opening it so deep `UiScrollable` targets (hooks at the bottom of **All**) are not required. Manual QA still uses **All** (or each section) to reach every format.

**Native coverage flush:** After each top-level smoke suite, while the Appium session is still alive, WDIO taps home **Flush coverage** (`gma.debug.flushCoverage`) so `react-native-coverage` `flush()` dumps Emma/LLVM (and Istanbul when Metro is instrumented) before process kill. Agent pull/report/assert: [coverage design § native agent collection](coverage-design.md#native-agent-collection).

**Android app path:** default `RNGoogleMobileAdsExample/android/app/build/outputs/apk/debug/app-debug.apk` after `yarn tests:android:build` (override `RNGMA_ANDROID_APK`). **iOS:** set `RNGMA_IOS_APP` to a built `.app`, or rely on auto-discovery of the example simulator build / DerivedData path (`tooling/appium/src/formats.ts` `iosAppPath`), or install via `yarn tests:ios:run` and use `appium:bundleId` `com.microsoft.ReactTestApp`.

<a id="platform-coverage-gate-blocking"></a>

## Platform coverage gate

**Owner for which e2e/Jest this diff needs.** Lint/tsc: [lint-by-tree](validation-checklist.md#lint-and-formatting) and [evidence](validation-checklist.md#validation-evidence-package). Other docs hop here. Apply **every matching row**, except where a row states it **supersedes** another. JS-only `packages/core/src/` does not apply if `packages/core/src/specs/**`, `packages/core/android/**`, or `packages/core/ios/**` also changed.

| Diff | Required before impl/review gates |
|------|-----------------------------------|
| Docs/md/OKF only (`docs/**`, `**/*.md`, `okf-bundle/**`, `AGENTS.md`, `CONTRIBUTING.md`; no product trees) | No e2e. |
| `packages/core/__tests__/` only | Root `yarn tests:jest` (paths as needed). **Not** native e2e. |
| JS-only `packages/core/src/` excluding `packages/core/src/specs/**` | `yarn prepare` + root Jest. Packager only if you will actually start Metro; JS-only does not require it. **Not** native e2e. |
| JS/config plugin only (`packages/core/plugin/**`, `packages/core/app.plugin.js`; no native-manifest/plist output) | [GMA-AD-1](../architecture-decisions.md#gma-ad-1) + [Expo plugin](validation-checklist.md#expo-plugin). Not native e2e. |
| Pure path relocate / workspace layout (no semantic change to native, specs, or plugin output) | Keep named scripts valid; **not** native e2e. **Supersedes** the `RNGoogleMobileAdsExample/**` row when example edits are only path/`workspace:`/import-path updates for that relocate (no runtime or native example behavior change). |
| Appium config / drivers / testIDs-only (`tooling/appium/**` drivers/validate/helpers and/or example `testID` props only; no format gallery behavior change; no device specs change) | `yarn tests:appium:validate`. **Not** device Appium. **Supersedes** the example Appium device row for those edits. |
| Kotlin style-only / ktlint format on `packages/core/android/**` (`.kt` whitespace/style only; no semantic native behavior change) | **Not** native e2e. Same spirit as pure path relocate. **Supersedes** the `packages/core/android/**` clause of the plugin/native row when android edits are ktlint format/style-only. |
| Native unit-test harness only (`packages/core/android/src/test/**` and/or `packages/core/ios/Tests/**`, plus Robolectric/XCTest wiring in `packages/core/android/build.gradle`, podspec `test_spec` / `exclude_files`, or `packages/core/ios/RNGoogleMobileAdsUnitTests.xcodeproj`; no production native behavior change) | Touched platforms: `yarn tests:android:unit` and/or `yarn tests:ios:unit`. **Not** native e2e. **Supersedes** the plugin/native row for those harness-only edits. |
| Touched `tooling/appium/test/specs/**` or Appium format smoke behavior | Android: `yarn tests:packager` (or `:reset-cache` when [pre-flight](#pre-flight) says free `:8081`) + `yarn tests:android:build` + `yarn tests:appium:android`. iOS: `yarn tests:packager` (same reset) + `yarn tests:ios:pod:install` + `yarn tests:ios:run` + `yarn tests:appium:ios`. Specs that changed, on the platform(s) those specs exercise. [Tee](#local-e2e-commands). |
| `RNGoogleMobileAdsExample/**` (example app/config, not `node_modules`) | Android: `yarn tests:packager` (or `:reset-cache` when [pre-flight](#pre-flight) says free `:8081`) + `yarn tests:android:build` + `yarn tests:appium:android`. iOS: `yarn tests:packager` (same reset) + `yarn tests:ios:pod:install` + `yarn tests:ios:run` + `yarn tests:appium:ios`. Each platform the example change can affect. [Tee](#local-e2e-commands). Does **not** apply when the pure path relocate / workspace layout row **or** the Appium config / testIDs-only row already covers the example edits. |
| Plugin output that changes native manifests/plists, or touched `packages/core/android/**`, `packages/core/ios/**`, podspec, or `packages/core/src/specs/**` | Android: `yarn tests:packager` (or `:reset-cache` when [pre-flight](#pre-flight) says free `:8081`) + `yarn tests:android:build` + `yarn tests:appium:android`. iOS: `yarn tests:packager` (same reset) + `yarn tests:ios:pod:install` + `yarn tests:ios:run` + `yarn tests:appium:ios`. **Each affected platform.** [Tee](#local-e2e-commands). |

A green run of **unrelated** e2e files does not close review for the touched area.

`full` / `pre-merge-validation`: [validation-checklist work types](validation-checklist.md#work-types) (this table **and** lint-by-tree / evidence for this diff). CI e2e jobs are not the pass signal ([continue-on-error](../ci-workflows/index.md#e2e-continue-on-error)).

<a id="pre-flight"></a>

## Pre-flight

**Blocking.** [Prepare must finish first](agent-command-policy.md#prepare-must-finish-first): `yarn` then `yarn prepare` before Metro/e2e (this pass runs Metro/native). Do not parallelize prepare with packager, Jest, Gradle, or pods. What to record stays on the [evidence prepare row](validation-checklist.md#validation-evidence-package).

Before taking any e2e slot required by this task, determine whether another task owns it. If the slot is occupied and this task has no explicit ownership transfer, ask the user whether this task may take it. Without authorization, do not stop or otherwise displace the owner. Once ownership is transferred, take the slot and continue.

Port `:8081` is one serialized e2e resource, not the ownership rule itself. Metro used by this task on `:8081` must be **this** checkout (`RNGoogleMobileAdsExample/`), not another worktree, and the port must be free before `yarn tests:packager:reset-cache`. Revert `.only` before area-focused/full.

Interrupted Shell: log footer `N passing`/`N failing` = complete. An open tee or missing footer is **not** success — recover Metro `:8081` and re-run the **same** command.

<a id="e2e-diagnosis"></a>

## Diagnosis

1. Confirm [pre-flight](#pre-flight).
2. Same failure twice on the canonical command → narrow to one file or `.only` (`unit-focused` only).
3. Read `/tmp/rngma-e2e-ios-*.log` / `/tmp/rngma-e2e-android-*.log` (CI: `simulator_log` / `adb_logs` — [CI workflows](../ci-workflows/index.md)).
4. Revert `.only` and extra native logging before area-focused review or commit.

Do not invent harness override files or debug flags from other repos.

Merge: no `.only`. Pre-merge validation: [platform coverage](#platform-coverage-gate-blocking) for this diff (CI e2e not the pass) **and** the lint/tsc/coverage rows that [validation evidence](validation-checklist.md#validation-evidence-package) / [lint-by-tree](validation-checklist.md#lint-and-formatting) already require for this diff.
