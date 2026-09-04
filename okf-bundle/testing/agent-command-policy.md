---
type: Reference
title: Agent command policy
description: Allowlisted agent shell commands.
tags: [testing, validation, agents, yarn]
timestamp: 2026-08-22T00:00:00Z
---

# Agent command policy

If a command is not listed (or linked) here, **do not run it**. E2e: [local e2e commands](running-e2e.md#local-e2e-commands).

1. Registry only, repo root unless noted.
2. When this pass runs tsc/Jest/lint/Metro/native: `yarn` then `yarn prepare` exit 0 first — [§ prepare](#prepare-must-finish-first).
3. On lint check failure: [lint-and-formatting](validation-checklist.md#lint-and-formatting) (check vs `:fix`/`--replace` by work type). For other failures: [§ frozen tree](change-authoring-workflow.md#frozen-tree) — on `independent-review`, record a finding and do not edit (except revert `.only`); apply per that heading (product/lint → `implementation`; `okf-bundle/` / `AGENTS.md` / `CONTRIBUTING.md` → `documentation?`), then re-run the **same** command.
4. [Constraints block](#constraints-block).

<a id="canonical-registry"></a>

## Canonical registry

| Intent | Command | Never |
|--------|---------|-------|
| Install | `yarn` | `npm install`; example-only install first |
| Example deps | `yarn tests:install` | `npm install` in example |
| `packages/core/src/` → `lib/` + plugin | `yarn prepare` (runs `yarn lerna:prepare`) | ad-hoc bob/babel/tsc; skip Lerna/Nx env |
| TS check | `yarn tsc:compile` | invented `tsc` configs |
| Jest | `yarn tests:jest`, `yarn tests:jest-coverage` | `npx jest` random cwd |
| Android JVM unit (Robolectric) | `yarn tests:android:unit` → example `./gradlew :react-native-google-mobile-ads:testDebugUnitTest` (sources under `packages/core/android/src/test/`; owned mapper/helper tests + harness smoke) | ad-hoc `./gradlew … testDebugUnitTest` outside this yarn script; treating library-folder standalone AGP as the gate |
| iOS XCTest unit | `yarn tests:ios:unit` → `xcodebuild test` on `packages/core/ios/RNGoogleMobileAdsUnitTests.xcodeproj` (sources under `packages/core/ios/Tests/`; lightweight harness also compiles `RNGoogleMobileAdsOwnedMappers`; podspec `UnitTests` test_spec mirrors Tests) | ad-hoc `xcodebuild test` outside this yarn script |
| iOS CocoaPods (example) | `yarn tests:ios:pod:install` (`pod install --repo-update` under `RNGoogleMobileAdsExample/ios/`; keeps `Podfile.lock`) | bare `pod install`; deleting `Podfile.lock` to “force” a refresh; assuming publish CI runs on Linux |
| Release iOS lockfile refresh | `yarn release:refresh-ios-pod-lockfile` (Darwin; two `yarn tests:ios:pod:install` + pin assert + `git diff --exit-code` on `RNGoogleMobileAdsExample/ios/Podfile.lock`). Safe checks: `node ./scripts/refresh-ios-pod-lockfile.js --assert-pins-only` / `--self-check`. semantic-release prepare runs the full refresh on publish | inventing a second release path; refreshing lockfiles on Linux publish runners |
| Lint (local) | [lint-by-tree](validation-checklist.md#lint-and-formatting) (`yarn lint:js` / `yarn lint:android` / `yarn lint:ios:check`; check vs `:fix`/`--replace` by work type) | ad-hoc eslint; `npx google-java-format`; invented `clang-format` / prettier |
| Kotlin check (Android `.kt`) | repo-root `./gradlew ktlintCheck` (frozen review / check-only) | ad-hoc example `gradlew`; inventing yarn wrappers for ktlint |
| Kotlin format (Android `.kt`) | repo-root `./gradlew ktlintFormat` (optional `-PinternalKtlintGitFilter=…`; implementation / documentation) | ad-hoc example `gradlew`; inventing yarn wrappers for ktlint |
| Lint CI combo | `yarn lint:code` locally only if this diff includes `packages/core/src/` **and** `packages/core/android/` **and** `packages/core/ios/` — [lint-and-formatting](validation-checklist.md#lint-and-formatting) | do not use **this** command as the local default; do not use it on a single- or two-tree diff; do not use it on frozen `independent-review` |
| Lint + tsc | `yarn lint` (`lint:code` + `tsc:compile`) locally only if this diff includes `packages/core/src/` **and** `packages/core/android/` **and** `packages/core/ios/` — [lint-and-formatting](validation-checklist.md#lint-and-formatting) | do not treat as the same as `yarn lint:code`; do not use **this** command as the local default on a narrower diff; do not use it on frozen `independent-review` |
| Docs | `yarn lint:markdown:check`, `yarn lint:spellcheck` when `docs/**` — [lint-and-formatting](validation-checklist.md#lint-and-formatting) | ad-hoc prettier as gate; markdown check on an OKF/`AGENTS.md`/`CONTRIBUTING.md`-only diff |
| Packager | `yarn tests:packager`, `yarn tests:packager:reset-cache` | bare Metro |
| E2e | [local e2e names](running-e2e.md#local-e2e-commands); which to run: [platform coverage](running-e2e.md#platform-coverage-gate-blocking) | `npx appium` / `npx wdio` outside named scripts; `detox test`; globs; running every named e2e script unless that table requires it |
| Appium | `yarn tests:appium:validate`; after drivers: `yarn tests:appium:drivers:install` then `yarn tests:appium:drivers:verify`; device runs: `yarn tests:appium:android` / `yarn tests:appium:ios` ([Appium](running-e2e.md#appium-scaffold)) | inventing `npx appium` / `npx wdio` outside those scripts; treating device Appium as required when [platform coverage](running-e2e.md#platform-coverage-gate-blocking) says validate-only |
| Native coverage (pull/report/assert) | From example cwd / workspace: `yarn workspace RNGoogleMobileAdsExample exec rn-coverage <args>` after device Appium + in-app flush — [coverage design § native agent collection](coverage-design.md#native-agent-collection) | copying RNFB coverage shell scripts; inventing root yarn wrappers that re-implement pull/export; running pull before Appium teardown flush |
| `.only` scan | `rg '\.only\(' packages/core/src/ packages/core/plugin/ packages/core/__tests__/ tooling/appium/` | other grep as the gate |

Redirect/`tee` of the **same** listed yarn script is allowed. Do not add other wrappers.

<a id="prepare-must-finish-first"></a>

## Prepare must finish first

`yarn` / `yarn prepare` only when this pass will run tsc, Jest, lint, Metro, or native. `yarn lint:markdown:check` and `yarn lint:spellcheck` **are** lint — they require `yarn` then `yarn prepare`.

- Skip both when this pass will not run tsc/Jest/lint (including markdown/spellcheck)/Metro/native (for example `okf-bundle/` / `AGENTS.md` / `CONTRIBUTING.md` with no `docs/**`). A `documentation` pass on `docs/**` is **not** a skip.
- When this pass will run them, run prepare first even if the [evidence prepare row](validation-checklist.md#validation-evidence-package) is `n/a` (for example android-only lint: run prepare; do not record it in that row).

`yarn` / `yarn prepare` are blocking (`lerna:prepare` → per-package genversion → bob → plugin). Metro reads `packages/core/lib/`. Do not parallelize with Jest/tsc/Gradle/pods.

Sandbox with no exit status on e2e/packager/Gradle/pods, or Jest Watchman `fchmod` EPERM: retry the **same** command unrestricted. If Watchman `fchmod` still fails unrestricted, retry that same yarn Jest script with `--watchman=false`.

Traps: `genversion` via `yarn prepare` only. Example depends on the `react-native-google-mobile-ads` workspace package — prepare before Metro. CI lint = `yarn lint:code` + repo-root `./gradlew ktlintCheck`; CI tsc = `yarn tsc:compile`; docs CI = `yarn lint:spellcheck`.

<a id="constraints-block"></a>

## Constraints block

```text
RNGMA: okf-bundle/testing/agent-command-policy.md ONLY.
Lint: validation-checklist.md#lint-and-formatting only (lint:js / lint:android / lint:ios:check by tree under packages/core/; root `./gradlew ktlintCheck` (frozen/check) / `./gradlew ktlintFormat` (implementation) for Android `.kt`; check vs :fix/--replace by work type; yarn lint:code only if packages/core src AND android AND ios AND not frozen independent-review; yarn lint is lint:code plus tsc).
E2e names: running-e2e.md#local-e2e-commands (tee of those same named scripts OK). Which to run: running-e2e.md#platform-coverage-gate-blocking. Do not glob yarn tests:android:* (Windows/release names) or yarn tests:ios:*. Do not run every named e2e script unless that table requires it. Jest, Android/iOS JVM/XCTest unit (`yarn tests:android:unit` / `yarn tests:ios:unit`), and packager stay Canonical registry names. Appium: running-e2e.md#appium-scaffold + registry Appium row (`yarn tests:appium:validate` / drivers / android / ios only). Native coverage pull/report: coverage-design.md#native-agent-collection + registry Native coverage row (`yarn workspace RNGoogleMobileAdsExample exec rn-coverage …` only; no copied RNFB scripts).
Never detox/npm install/ad-hoc gradlew (except root `./gradlew ktlintCheck` / `./gradlew ktlintFormat`)/`npx google-java-format` (Java gate is yarn lint:android; Kotlin check is root `./gradlew ktlintCheck`, format is root `./gradlew ktlintFormat`). Android JVM unit: yarn tests:android:unit only. iOS XCTest unit: yarn tests:ios:unit only. Do not invent `jet` / `npx jet` (Jet harness removed).
yarn then yarn prepare when this pass runs tsc/Jest/lint (including markdown/spellcheck)/Metro/native (agent-command-policy.md#prepare-must-finish-first). Same command on retry except lint hops #lint-and-formatting; other failures hop #frozen-tree.
Gates: validation-checklist.md#validation-evidence-package (+ coverage-design.md#coverage-evidence-package if packages/core src/ or android/ or ios/ or plugin/ TS).
```
