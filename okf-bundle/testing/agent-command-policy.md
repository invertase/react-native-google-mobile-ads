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
| Core library Codegen | `yarn codegen:android`, `yarn codegen:ios`, `yarn codegen:all`, `yarn codegen:verify`, `yarn codegen:self-check` — [GMA-AD-3](../architecture-decisions.md#gma-ad-3) / [GMA-AD-4](../architecture-decisions.md#gma-ad-4); shared runner resolves and verifies the exact example-owned RN/Codegen/CLI toolchain, then wipes the selected committed tree before RN `--source library`; verify regenerates both and checks only those trees | hand-editing generated files; direct Codegen CLI; formatting generated output |
| TS check | `yarn tsc:compile` | invented `tsc` configs |
| Jest | `yarn tests:jest`, `yarn tests:jest-coverage` | `npx jest` random cwd |
| Android JVM unit (Robolectric) | `yarn tests:android:unit` → example `./gradlew :react-native-google-mobile-ads:testDebugUnitTest` (sources under `packages/core/android/src/test/`; owned mapper/helper tests + harness smoke) | ad-hoc `./gradlew … testDebugUnitTest` outside this yarn script; treating library-folder standalone AGP as the gate |
| iOS XCTest unit | `yarn tests:ios:unit` → `xcodebuild test` on `packages/core/ios/RNGoogleMobileAdsUnitTests.xcodeproj` (sources under `packages/core/ios/Tests/`; lightweight harness also compiles `RNGoogleMobileAdsOwnedMappers`; podspec `UnitTests` test_spec mirrors Tests) | ad-hoc `xcodebuild test` outside this yarn script |
| Ruby bundle (iOS prerequisite) | root `BUNDLE_FROZEN=true bundle install` — required once on a clean machine and again after `Gemfile.lock` changes, **before** any `yarn tests:ios:pod:install`. Root `Gemfile` / `Gemfile.lock` own the shared Ruby toolchain (CocoaPods + `xcodeproj` pins); `Gemfile.lock`'s `BUNDLED WITH` is the Bundler pin and frozen mode makes that lock authoritative, so drift fails instead of silently resolving. CI and publish retry the **same** command before Yarn ([CI workflows](../ci-workflows/index.md#publish-podfile-lock)) | `bundle install` / `bundle update` without `BUNDLE_FROZEN=true` to get past a frozen failure (fix `Gemfile.lock` in a product pass instead); global `gem install` / `gem update cocoapods xcodeproj`; a per-example `Gemfile` |
| iOS CocoaPods (example) | `yarn tests:ios:pod:install` — sole canonical pod operation: root `bundle exec pod install --project-directory=RNGoogleMobileAdsExample/ios --repo-update` (keeps `Podfile.lock`). Needs the Ruby bundle row above first; `bundle exec` fails on an uninstalled bundle | bare `pod` / `pod install`; deleting `Podfile.lock` to “force” a refresh; assuming publish CI runs on Linux |
| Android example run | `yarn tests:android:run` — serial uses RN CLI; slot mode validates/boots the exact AVD+serial then serial-scopes assemble/reverse/install/launch — [e2e slots](running-e2e.md#e2e-slots) | inventing `adb install` / `am start` outside this yarn script; using RN CLI against a slot; installing onto an unrelated emulator |
| iOS example run | `yarn tests:ios:run` (codegen, frozen named pod install, `react-native build-ios --buildFolder build`, then exact-path `simctl install` / `launch` on the required appended `--udid`; slot-mode selector UDID/runtime: [e2e slots](running-e2e.md#e2e-slots); exact app path: [running-e2e](running-e2e.md#appium-scaffold)) | `run-ios` / DerivedData discovery; bare `pod`; omitting `--udid`; slot mode with an arbitrary or serial UDID |
| Release iOS lockfile refresh | `yarn release:refresh-ios-pod-lockfile` (Darwin; two `yarn tests:ios:pod:install` + pin assert + `git diff --exit-code` on `RNGoogleMobileAdsExample/ios/Podfile.lock`), so it inherits the same frozen root bundle prerequisite. Safe checks: `node ./scripts/refresh-ios-pod-lockfile.js --assert-pins-only` / `--self-check`. semantic-release prepare runs the full refresh on publish | inventing a second release path; refreshing lockfiles on Linux publish runners; a global-gem CocoaPods install as the release toolchain |
| Release package surface | `node ./scripts/semantic-release-sync-package-versions.js --self-check` | a real npm publish; including private package templates |
| Lint (local) | [lint-by-tree](validation-checklist.md#lint-and-formatting) (`yarn lint:js` / `yarn lint:android` / `yarn lint:ios:check`; check vs `:fix`/`--replace` by work type) | ad-hoc eslint; `npx google-java-format`; invented `clang-format` / prettier |
| Kotlin check (Android `.kt`) | repo-root `./gradlew ktlintCheck` (frozen review / check-only) | ad-hoc example `gradlew`; inventing yarn wrappers for ktlint |
| Kotlin format (Android `.kt`) | repo-root `./gradlew ktlintFormat` (optional `-PinternalKtlintGitFilter=…`; implementation / documentation) | ad-hoc example `gradlew`; inventing yarn wrappers for ktlint |
| Lint CI combo | `yarn lint:code` locally only if this diff includes `packages/core/src/` **and** `packages/core/android/` **and** `packages/core/ios/` — [lint-and-formatting](validation-checklist.md#lint-and-formatting) | do not use **this** command as the local default; do not use it on a single- or two-tree diff; do not use it on frozen `independent-review` |
| Lint + tsc | `yarn lint` (`lint:code` + `tsc:compile`) locally only if this diff includes `packages/core/src/` **and** `packages/core/android/` **and** `packages/core/ios/` — [lint-and-formatting](validation-checklist.md#lint-and-formatting) | do not treat as the same as `yarn lint:code`; do not use **this** command as the local default on a narrower diff; do not use it on frozen `independent-review` |
| Docs | `yarn lint:markdown:check`, `yarn lint:spellcheck` when `docs/**` — [lint-and-formatting](validation-checklist.md#lint-and-formatting) | ad-hoc prettier as gate; markdown check on an OKF/`AGENTS.md`/`CONTRIBUTING.md`-only diff |
| Packager | `yarn tests:packager`, `yarn tests:packager:reset-cache` | bare Metro |
| Native e2e Codegen | `yarn tests:e2e:codegen` (example RN CLI, iOS `--source app`; core library output is already committed and skipped; invoked before CocoaPods by canonical iOS build/Appium paths) | regenerating or deleting committed core output; treating app/probe Codegen as committed library output; direct Codegen CLI |
| Appium resource check/release | `yarn tests:appium:check` / `yarn tests:appium:release` with documented `--slot`, `--platform`, `--metro-owner-slot`, `--all-slots`, `--services`/`--strict`, `--devices`, and `--only` flags — [e2e slots](running-e2e.md#e2e-slots). Slotted Metro release requires explicit matching owner scope; consumer slots never release it | ad-hoc `lsof`/kill cleanup; inferred/per-consumer Metro cleanup; slots `0`/`3`; unrelated listeners/devices; global simulator shutdown/delete/erase/rename; Detox clones |
| Slot device provisioning (create-only) | `RNGMA_E2E_SLOT=<1\|2\|4-7> yarn tests:appium:provision <android\|ios\|both>` before first device use when the exact slot device is missing; single-platform args must match `RNGMA_E2E_PLATFORM` when set, and `both` requires it unset — [e2e slots](running-e2e.md#e2e-slots) | slot `0` or reserved slot `3`; omitted/other platform; `both` with `RNGMA_E2E_PLATFORM` set; mismatched single platform; direct `sdkmanager` / `avdmanager` / `simctl create`; delete, erase, rename, or overwrite; expecting Appium/select-and-boot to create |
| E2e | [local e2e names](running-e2e.md#local-e2e-commands); which to run: [platform coverage](running-e2e.md#platform-coverage-gate-blocking) | `npx appium` / `npx wdio` outside named scripts; `detox test`; globs; running every named e2e script unless that table requires it |
| Appium | `yarn tests:appium:validate`; driver install/verify; serial/manual Android/iOS; preferred combined `yarn tests:appium:parallel`; configurable single-platform owners; advanced simultaneous-platform `:parallel:external` consumers; iOS select/prebuild-WDA — exact names, slot configuration, barrier, prerequisites, and ownership: [parallel Appium](running-e2e.md#parallel-appium), [e2e slots](running-e2e.md#e2e-slots), [prebuilt WDA](running-e2e.md#ios-wda-prebuilt-validation) | inventing direct Appium/WDIO commands; setting internal parallel spec/parent/Metro variables; invoking workspace implementation directly; opportunistic attachment; allowing an external consumer to start/stop Metro; claiming simultaneous sessions without the combined barrier; skipping provisioning or iOS WDA prerequisites |
| Native coverage (pull/report/assert) | From example cwd / workspace: `yarn workspace RNGoogleMobileAdsExample exec rn-coverage <args>` after device Appium + in-app flush — [coverage design § native agent collection](coverage-design.md#native-agent-collection) | copying RNFB coverage shell scripts; inventing root yarn wrappers that re-implement pull/export; running pull before Appium teardown flush |
| `.only` scan | `rg '\.only\(' packages/core/src/ packages/core/plugin/ packages/core/__tests__/ tooling/appium/` | other grep as the gate |

Redirect/`tee` of the **same** listed yarn script is allowed, as is setting documented `RNGMA_*` variables — including sourcing the `--github-env` file written by `yarn tests:appium:ios:select-and-boot` ([§ prebuilt validation](running-e2e.md#ios-wda-prebuilt-validation)). Do not add other wrappers.

<a id="prepare-must-finish-first"></a>

## Prepare must finish first

`yarn` / `yarn prepare` only when this pass will run tsc, Jest, lint, Metro, or native. `yarn lint:markdown:check` and `yarn lint:spellcheck` **are** lint — they require `yarn` then `yarn prepare`.

- Skip both when this pass will not run tsc/Jest/lint (including markdown/spellcheck)/Metro/native (for example `okf-bundle/` / `AGENTS.md` / `CONTRIBUTING.md` with no `docs/**`). A `documentation` pass on `docs/**` is **not** a skip.
- When this pass will run them, run prepare first even if the [evidence prepare row](validation-checklist.md#validation-evidence-package) is `n/a` (for example android-only lint: run prepare; do not record it in that row).

`yarn` / `yarn prepare` are blocking (`lerna:prepare` → per-package genversion → bob → plugin). Metro reads `packages/core/lib/`. Do not parallelize with Jest/tsc/Gradle/pods.

Sandbox with no exit status on e2e/packager/Gradle/pods, or Jest Watchman `fchmod` EPERM: retry the **same** command unrestricted. If Watchman `fchmod` still fails unrestricted, retry that same yarn Jest script with `--watchman=false`.

Traps: `genversion` via `yarn prepare` only. Example depends on the `react-native-google-mobile-ads` workspace package — prepare before Metro. CI lint/tsc/docs commands: [CI workflows](../ci-workflows/index.md#workflows) (lint includes `yarn codegen:verify`; do not copy that combo locally).

<a id="constraints-block"></a>

## Constraints block

```text
RNGMA: okf-bundle/testing/agent-command-policy.md ONLY.
Lint: validation-checklist.md#lint-and-formatting only (lint:js / lint:android / lint:ios:check by tree under packages/core/; root `./gradlew ktlintCheck` (frozen/check) / `./gradlew ktlintFormat` (implementation) for Android `.kt`; check vs :fix/--replace by work type; yarn lint:code only if packages/core src AND android AND ios AND not frozen independent-review; yarn lint is lint:code plus tsc).
Core library Codegen: `yarn codegen:android` / `codegen:ios` / `codegen:all` / `codegen:verify` / `codegen:self-check` only (GMA-AD-3; wipe-then-regen committed package trees with `--source library`; never hand-edit or format generated output). Native e2e Codegen: `yarn tests:e2e:codegen` only (example iOS `--source app`; core library output stays committed; Android Gradle generates app/probe metadata at build time). iOS pods: root `BUNDLE_FROZEN=true bundle install` first, then `yarn tests:ios:pod:install` only (root `bundle exec` with `--project-directory`; root Gemfile). Android run: `yarn tests:android:run` only (serial RN CLI vs slot serial-scoped path: running-e2e.md#e2e-slots). iOS run: `yarn tests:ios:run --udid <selected-udid>` only (`build-ios --buildFolder build`, then exact-path `simctl install` / `launch`; slot-mode selector UDID/runtime: running-e2e.md#e2e-slots; artifact path on running-e2e.md#appium-scaffold).
E2e names: running-e2e.md#local-e2e-commands (tee of those same named scripts OK). Resource ownership/recovery and slot provisioning: running-e2e.md#e2e-slots (`yarn tests:appium:check` / `release` only for host probes and scoped cleanup; never slots 0/3 or unrelated resources; `RNGMA_E2E_SLOT=<1|2|4-7> yarn tests:appium:provision <android|ios|both>` create-only before first device use when missing; Appium/select-and-boot never create). Preferred combined parallel owner, single-platform owner/external commands, `RNGMA_E2E_PARALLEL_SLOTS`, exact three-slot ownership, and cross-platform session barrier: running-e2e.md#parallel-appium; never set internal spec/parent/Metro variables. Which to run: running-e2e.md#platform-coverage-gate-blocking. Do not glob yarn tests:android:* (Windows/release names) or yarn tests:ios:*. Do not run every named e2e script unless that table requires it. Jest, Android/iOS JVM/XCTest unit (`yarn tests:android:unit` / `yarn tests:ios:unit`), and packager stay Canonical registry names. Appium: running-e2e.md#appium-scaffold + registry Appium row; iOS selection/prebuild sequence: running-e2e.md#ios-wda-prebuilt-validation. Native coverage pull/report: coverage-design.md#native-agent-collection + registry Native coverage row (`yarn workspace RNGoogleMobileAdsExample exec rn-coverage …` only; no copied RNFB scripts).
Never detox/npm install/ad-hoc gradlew (except root `./gradlew ktlintCheck` / `./gradlew ktlintFormat`)/`npx google-java-format` (Java gate is yarn lint:android; Kotlin check is root `./gradlew ktlintCheck`, format is root `./gradlew ktlintFormat`). Android JVM unit: yarn tests:android:unit only. iOS XCTest unit: yarn tests:ios:unit only. Do not invent `jet` / `npx jet` (Jet harness removed).
yarn then yarn prepare when this pass runs tsc/Jest/lint (including markdown/spellcheck)/Metro/native (agent-command-policy.md#prepare-must-finish-first). Same command on retry except lint hops #lint-and-formatting; other failures hop #frozen-tree.
iOS pods: root `BUNDLE_FROZEN=true bundle install` (clean machine, and after Gemfile.lock changes) before `yarn tests:ios:pod:install`; never bare pod, never unfrozen bundle install/update, never global gem install/update.
Gates: validation-checklist.md#validation-evidence-package (+ coverage-design.md#coverage-evidence-package if packages/core src/ or android/ or ios/ or plugin/ TS).
```
