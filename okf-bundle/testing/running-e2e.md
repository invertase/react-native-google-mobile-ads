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

Once: `yarn && yarn prepare`; on iOS also root `BUNDLE_FROZEN=true bundle install` **before** `yarn tests:ios:pod:install`, because that script is `bundle exec pod install` and a clean machine has no bundle yet. Repeat the frozen install after `Gemfile.lock` changes. Root `Gemfile` / `Gemfile.lock` own the shared Ruby toolchain; never global `gem update`/`gem install` and never bare `pod` ([agent command policy](agent-command-policy.md#canonical-registry)). `yarn tests:install` is an alias for root `yarn` (workspaces).

<a id="local-e2e-commands"></a>

## Local e2e commands

**Names only.** Which of these to run is [platform coverage](#platform-coverage-gate-blocking). When running e2e, use only these named scripts (no `yarn tests:android:*` / `yarn tests:ios:*` globs). Do **not** run every named script unless that table requires it.

Named scripts: `yarn tests:packager`, `yarn tests:packager:reset-cache`, `yarn tests:e2e:codegen`, `yarn tests:android:build`, `yarn tests:android:run`, `yarn tests:ios:pod:install`, `yarn tests:ios:run`, `yarn tests:appium:android`, `yarn tests:appium:ios`, `yarn tests:appium:ios:select-and-boot`, `yarn tests:appium:ios:prebuild-wda`.

`yarn tests:e2e:codegen` always generates native metadata for **both Android and iOS** (`react-native codegen --platform all`), then removes only the transient Android app codegen tree that would create duplicate CMake targets. The canonical Android build/run and iOS run scripts invoke it before native work; Appium preflight invokes the same yarn target rather than duplicating its implementation. The frozen `tests:ios:pod:install` script remains exactly the bundled pod command and is called by `tests:ios:run` after codegen.

<a id="ios-wda-prebuilt-validation"></a>

`yarn tests:appium:ios:select-and-boot` **always** requires `--github-env <path>`; a missing flag or path still boots the simulator, then fails the command without persisting anything. It selects the exact-name simulator, boots it, waits on `simctl bootstatus`, then **appends** `RNGMA_IOS_UDID=<udid>` and `RNGMA_IOS_VERSION=<runtime>` lines to that file and prints the same pair on stdout. It writes a file only — it cannot export into the calling shell, and `$GITHUB_ENV` is not a local requirement:

- CI passes `--github-env "$GITHUB_ENV"` before the iOS build, so later workflow steps inherit both variables for `yarn tests:ios:run --udid`, simulator logging, `yarn tests:appium:ios:prebuild-wda`, and Appium with `usePrebuiltWDA`.
- Locally pass any writable path (for example `--github-env /tmp/rngma-ios-env`), then consume it either by exporting the file into the current shell (`set -a; . /tmp/rngma-ios-env; set +a`) or by prefixing the printed pair on each following named script (`RNGMA_IOS_UDID=… RNGMA_IOS_VERSION=… yarn tests:appium:ios:prebuild-wda`). Lines are unquoted `KEY=VALUE` holding a `simctl` UDID and runtime version, and each run appends, so prefer a fresh path per selection; sourcing an appended file takes the last selection.

`yarn tests:appium:ios` sets `RNGMA_WDA_PREBUILT=1` itself (root script, via `cross-env`), locally and in CI. There is no opt-out: the flag is not read from the caller's environment, so every iOS device run is prebuilt mode and preflight rejects it unless the complete `WebDriverAgentRunner-Runner.app` exists under the shared DerivedData path `tooling/appium/.wda-derived`. The canonical sequence is therefore:

1. `yarn tests:appium:ios:select-and-boot --github-env <path>`.
2. Consume that file as above, so `RNGMA_IOS_UDID` and `RNGMA_IOS_VERSION` reach both following commands.
3. `yarn tests:appium:ios:prebuild-wda` — fails fast without both variables; wipes and rebuilds `tooling/appium/.wda-derived` for that selection.
4. `yarn tests:appium:ios` — passes `usePrebuiltWDA` plus that `derivedDataPath`, so no WDA `xcodebuild` runs during session creation.

That artifact is gitignored but survives between runs, so later `yarn tests:appium:ios` runs on the same selection reuse it; re-run step 3 after removing the path or selecting a different simulator runtime. Keep `RNGMA_IOS_UDID` / `RNGMA_IOS_VERSION` exported for step 4 so Appium targets the same simulator and runtime the artifact was built for.

When those named scripts are the e2e gate, `tee` `yarn tests:appium:android` to a unique `/tmp/rngma-e2e-android-*.log` and `yarn tests:appium:ios` to a unique `/tmp/rngma-e2e-ios-*.log`. Redirect/`tee` of the **same** named yarn script is allowed; do not add other wrappers.

Device driver: Appium 3 + WebdriverIO in `tooling/appium/` ([§ Appium](#appium-scaffold)). Specs: `tooling/appium/test/specs/**/*.ts`. App: `RNGoogleMobileAdsExample/` (format gallery + stable `testID`s). One e2e at a time (`:8081`). No source edits during a run.

There is no separate macOS-app e2e target. iOS e2e is `yarn tests:ios:pod:install` / `yarn tests:ios:run` (install) then `yarn tests:appium:ios` (local Mac or CI `macos-15`; the required WDA prebuild comes first: [§ prebuilt WDA](#ios-wda-prebuilt-validation)).

GitHub Actions fails when the app install or Appium suite fails; artifact uploads remain unconditional. Local gates still require counts + `/tmp/rngma-e2e-*.log`, or triaged `simulator_log` / `adb_logs`.

<a id="appium-scaffold"></a>

## Appium

Private workspace `@invertase/rngma-appium` at `tooling/appium/` (Yarn workspace `tooling/*`; not a Lerna publish package). Stack: Appium 3 + WebdriverIO + UiAutomator2 + XCUITest. Broad **navigation/container smoke** samples representative **Banner** + **Collapsible Banner**, listed GAM banner sizes (**AnchoredAdaptiveBanner**, **Fluid**), plus interstitial / rewarded / rewarded interstitial / app open / native / GAM interstitial, and hooks / consent / inspector / debug seams; it does not claim those ads loaded. Remaining banner size variants stay reachable via the gallery accordion (manual QA).

Four separate Google-test-ID **request-outcome contracts** cover standard Banner auto-load, Native promise settlement, Interstitial after **Load** (never Show), and GAM Interstitial after **Load** (never Show). Each collects up to **ten fresh request attempts**. Only a **terminal** ad-serving classification (`loaded`, `no-fill`, `internal-error`, `other-error`) participates in that collection: `loaded` stops the format early; the other three continue through attempt ten without failing the suite. Retry backoff is 250 ms, 500 ms, 1000 ms, then capped at 2000 ms. A missing outcome marker, a timeout or other non-terminal wait, a missing or reused monotonic `requestId`, or any other WebDriver / navigation / container / probe / seam failure **hard-fails immediately** — those are not collected retries. Fresh-request mechanics: Banner auto-loads on open then taps **Reload**; Native remounts by returning to the gallery and re-opening the format; Interstitial / GAM Interstitial tap **Load** each attempt. Show is never tapped. Unique `requestId` values prove Native remounts issued a new request; a duplicate id fails.

Every collected attempt emits one stable `[request-outcome-attempt]` JSON line with `format`, `platform`, `attempt`, `requestId`, `classification`, `detail`, and `fingerprint` (`status` + `evidence`). Android Native `internal-error` fingerprints only when the request-scoped logcat window (cleared before each Native request) contains the exact Ads lines `<Google:HTML> Incorrect native ad response. Click actions were not properly specified` and `Ad failed to load : 0` **adjacent in the raw chronological stream**. Blank, whitespace, malformed, or other non-Ads interleaving rejects the match; a single trailing newline is file termination, not an intervening line. Same PID, that order, within 250 ms. iOS reports fingerprint capability `unavailable` if Native `internal-error` occurs (no request-scoped SDK-log window). Other classifications use `not-applicable`. Representative collection does **not** wrap in instrumentation-crash recovery; those failures fail the suite. The example derives `no-fill` from the structured v17 ad-error reason across banner callbacks, native promise rejection, and fullscreen events rather than matching message prose. Device-free validation drives the same collector orchestration, locks those outcomes, and rejects Show actions. What that sample has established so far: [§ request-outcome sample](#request-outcome-sample).

**Session split and restart policy:** Device smoke runs as **three** WDIO sessions (`formats.smoke.a-primary` / `b-secondary` / `c-tertiary`, lists in `tooling/appium/src/formats.ts`). Android UiAutomator2 tends to destabilize after roughly fifteen tests in one session; the split keeps each session shorter. Within a session, cases return to the section-filtered gallery and run back-to-back. A cold app restart is opt-in only for a format with demonstrated isolated-state needs. Navigation/container smoke may restart once after an instrumentation crash; representative request-outcome collection does not. iOS uses the same three-spec layout for parity. Every iOS session targets the same preflight-selected simulator UDID; more than one `appiumTest-*` simulator is always a leak/bug, never expected split-session behavior.

**Pins:** JS deps in `tooling/appium/package.json` + `yarn.lock`. Driver versions are **also** pinned in checked-in `tooling/appium/drivers.manifest.json` (Appium drivers are not fully guaranteed by the lockfile alone). Install into gitignored `tooling/appium/.appium-home/` (`APPIUM_HOME`) with `yarn tests:appium:drivers:install`, then `yarn tests:appium:drivers:verify`. Device-free config and host-preflight helper tests: `yarn tests:appium:validate`. Device runs: `yarn tests:appium:android` / `yarn tests:appium:ios`. iOS `appium:wdaLaunchTimeout` is 300s and the iOS WDIO connection timeout is longer so WDIO cannot SIGTERM a live WDA `xcodebuild`. Example UI uses stable `testID`s from `RNGoogleMobileAdsExample/src/appiumTestIds.ts` (mirrored in `tooling/appium/src/testIds.ts`).

**Probe TurboModule (Pattern C):** Example-only `@invertase/rngma-testing` (`portal:./modules/rngma-testing`) exposes `NativeRNGMATesting` (codegen + Android/iOS). Seed seams for delayed banner attach, debug inventory TTL, and ResponseInfo fixture JSON — not product package code. Product ResponseInfo serialization fixtures live under `packages/core/__tests__/fixtures/responseInfo/` (`loaded` / `no-fill` / `paid-compact`) and are asserted by Jest; native serializers attach the same shape on fullscreen/banner/native-ad load, load-error, and compact paid paths. Debug gallery entry `gma.format.native-rngma-testing` exercises `ping()`, probe fixtures, and public `AdPools.create` lifecycle coverage (start, availability, poll, peek, destroy); tertiary Appium smoke opens it and asserts `action.loaded` contains `ok ping=`. Use Yarn `portal:` (not `file:`) so native edits stay linked into `node_modules`. On a virgin iOS tree, if `<ReactCodegen/RNGMATestingSpec/…>` headers are missing after the first codegen, re-run `yarn tests:ios:pod:install` once so Public headers land, then `yarn tests:ios:run`.

**Gallery sections:** The example home screen filters with **All | Formats | Hooks | Debug** chips (`gma.gallery.section.*`). Appium helpers select the section that contains a format before opening it so deep `UiScrollable` targets (hooks at the bottom of **All**) are not required. Manual QA still uses **All** (or each section) to reach every format.

**Native coverage flush:** After each top-level smoke suite, while the Appium session is still alive, WDIO taps home **Flush coverage** (`gma.debug.flushCoverage`) so `react-native-coverage` `flush()` dumps Emma/LLVM (and Istanbul when Metro is instrumented) before process kill. Agent pull/report/assert: [coverage design § native agent collection](coverage-design.md#native-agent-collection).

<a id="android-app-path"></a>

**Android app path:** default `RNGoogleMobileAdsExample/android/app/build/outputs/apk/debug/app-debug.apk` after `yarn tests:android:build` (override `RNGMA_ANDROID_APK`). Appium install/reset may clear app data; the named Android Appium command restores React Native `debug_http_host=127.0.0.1:8081` after that reset and launches afterward. Do not invent ad hoc `adb` / SharedPreferences / launch steps. Metro reverse and connectivity for the selected serial are [pre-flight](#pre-flight). **iOS:** `yarn tests:ios:run --udid <selected-udid>` runs codegen, the exact frozen bundled pod script, `react-native build-ios --buildFolder build`, then installs and launches `RNGoogleMobileAdsExample/ios/build/Build/Products/Debug-iphonesimulator/ReactTestApp.app` on that simulator with `simctl`; Appium uses the same exact path. Set `RNGMA_IOS_APP` only to explicitly override Appium. Never discover an app from DerivedData or fall back to an installed bundle id.

<a id="request-outcome-sample"></a>

## Request-outcome sample

Cumulative aggregate from the [request-outcome contracts](#appium-scaffold) above. It is durable because these counts are the input that selects the acceptance contract each format can hold — see [documentation policy § cumulative verification-evidence tables](../documentation-policy.md#verification-evidence-tables) for why counts live here and why logs, run identifiers, and dates do not.

**Lower bound, not a census.** Every cell counts only attempts whose classification is verified and non-overlapping across sessions, so totals only ever grow. Absence of a count is not evidence that an outcome cannot occur. Every subsequent qualifying run feeds this sample. The published table is the snapshot at the last implementation or documentation pass before independent review; runs taken while that tree is frozen accumulate for the next permitted documentation pass and do not mutate the table under review.

| format | platform | attempts | loaded | no-fill | internal-error(fingerprinted) | other-error | current-acceptance |
|--------|----------|----------|--------|---------|-------------------------------|-------------|--------------------|
| Banner | android | 8 | 8 | 0 | 0 | 0 | collect |
| Banner | ios | 3 | 3 | 0 | 0 | 0 | collect |
| Native | android | 73 | 1 | 0 | 48 (+24 unfingerprinted) | 0 | collect |
| Native | ios | 3 | 3 | 0 | 0 | 0 | collect |
| Interstitial | android | 9 | 9 | 0 | 0 | 0 | collect |
| Interstitial | ios | 3 | 3 | 0 | 0 | 0 | collect |
| GAM Interstitial | android | 10 | 8 | 2 | 0 | 0 | collect |
| GAM Interstitial | ios | 3 | 3 | 0 | 0 | 0 | collect |

`internal-error(fingerprinted)` counts only attempts whose structured fingerprint is `matched` under the raw-stream adjacency contract above. `(+N unfingerprinted)` are collector `internal-error` attempts that are not `matched` (no signature; blank, whitespace, malformed, or other non-Ads interleaving; signature without the adjacent same-PID failure; or iOS `unavailable`); they are real internal errors and are not counted as fingerprinted. Outcome columns sum to `attempts` in each row (`48 (+24)` is 72).

That Native signature is Google serving a malformed native creative, not a local defect: it reproduced on API 29 **and** API 36 `google_apis`, and with both `TestIds.NATIVE` and `GAM_NATIVE`, so it is neither emulator-image- nor ad-unit-specific. The same Native contract has also loaded, and the official GAM interstitial test unit has returned `no-fill` twice in a session where the standard Interstitial loaded — so these are intermittent server-side outcomes that any per-format acceptance has to tolerate.

`current-acceptance` is the contract in force **while this sample is being gathered**: `collect` means every terminal ad-serving outcome is accepted and only the hard failures above can fail the format. It is not a landed acceptance decision — later work analyzes sufficiency and may tighten per format, so do not cite a row as a settled requirement.

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
| Native unit-test harness only (`packages/core/android/src/test/**` and/or `packages/core/ios/Tests/**`, plus Robolectric/XCTest wiring in `packages/core/android/build.gradle`, podspec `test_spec` / `exclude_files`, or `packages/core/ios/RNGoogleMobileAdsUnitTests.xcodeproj`; no production native behavior change) | Touched platforms: `yarn tests:android:unit` and/or `yarn tests:ios:unit`. **Not** native e2e. **Supersedes** the plugin/native row for those harness-only edits. Does **not** apply when the Diff also touches production `packages/core/ios/RNGoogleMobileAds/**` / `packages/core/android/src/main/**` (e.g. OwnedMappers extract + `Common` delegate) — that stays on the plugin/native Appium row for the affected platform. |
| Touched `tooling/appium/test/specs/**` or Appium format smoke behavior | Android: `yarn tests:packager` (or `:reset-cache` when [pre-flight](#pre-flight) says free `:8081`) + `yarn tests:android:build` + `yarn tests:appium:android`. iOS: `yarn tests:packager` (same reset) + `yarn tests:ios:pod:install` + `yarn tests:ios:run` + `yarn tests:appium:ios`. Specs that changed, on the platform(s) those specs exercise. [Tee](#local-e2e-commands). |
| `RNGoogleMobileAdsExample/**` (example app/config, not `node_modules`) | Android: `yarn tests:packager` (or `:reset-cache` when [pre-flight](#pre-flight) says free `:8081`) + `yarn tests:android:build` + `yarn tests:appium:android`. iOS: `yarn tests:packager` (same reset) + `yarn tests:ios:pod:install` + `yarn tests:ios:run` + `yarn tests:appium:ios`. Each platform the example change can affect. [Tee](#local-e2e-commands). Does **not** apply when the pure path relocate / workspace layout row **or** the Appium config / testIDs-only row already covers the example edits. |
| Plugin output that changes native manifests/plists, or touched `packages/core/android/**`, `packages/core/ios/**`, podspec, or `packages/core/src/specs/**` | Android: `yarn tests:packager` (or `:reset-cache` when [pre-flight](#pre-flight) says free `:8081`) + `yarn tests:android:build` + `yarn tests:appium:android`. iOS: `yarn tests:packager` (same reset) + `yarn tests:ios:pod:install` + `yarn tests:ios:run` + `yarn tests:appium:ios`. **Each affected platform.** [Tee](#local-e2e-commands). |

A green run of **unrelated** e2e files does not close review for the touched area.

`full` / `pre-merge-validation`: [validation-checklist work types](validation-checklist.md#work-types) (this table **and** lint-by-tree / evidence for this diff). Install/Appium CI failures fail the job; local counts/logs remain independent evidence ([truthful e2e checks](../ci-workflows/index.md#e2e-continue-on-error)).

<a id="pre-flight"></a>

## Pre-flight

**Blocking host floor:** use Node 24+ before install or e2e (`node --version`; all workspace engine declarations are `>=24`). Node 22 hard-fails this stack. An old nvm host may recover with `nvm install 24` then `nvm use 24`. If Yarn 4.10.3 on Node 24.20 flakes with `onCancel handler attached after promise settled`, retry the same `yarn` command; do not downgrade Node.

**Blocking preparation.** [Prepare must finish first](agent-command-policy.md#prepare-must-finish-first): `yarn` then `yarn prepare` before Metro/e2e (this pass runs Metro/native). Do not parallelize prepare with packager, Jest, Gradle, or pods. What to record stays on the [evidence prepare row](validation-checklist.md#validation-evidence-package).

Before Android Appium, inventory AVDs with `emulator -list-avds`; the canonical Appium command preflights connected devices, deterministically prefers API 36, passes its selected serial to WDIO, and verifies that serial's `tcp:8081` reverse **and** that the device can connect through it to this checkout's Metro. Do not invent a separate `adb reverse`. Session launch after Appium install/reset: [§ Android app path](#android-app-path). CI Android e2e uses that same image (API 36 `google_apis` x86_64; Play services, no Play Store login). UiAutomator2 requires Android 8+ (API 26): boot the reported qualifying AVD and retry the same command, never retry API 24. Before iOS Appium, preflight inventories `xcrun simctl list devices available`, selects an **existing exact-name iPhone 17** by UDID, and passes that UDID to every WDIO session. It prefers an already booted exact match, then the newest available runtime; `RNGMA_IOS_VERSION` constrains the runtime without a checked-in version pin, and an explicit `RNGMA_IOS_UDID` must resolve to an available exact-name match. The named selector opens each iOS device pass, because the required WDA prebuild consumes its variables: it boots that exact simulator and records `RNGMA_IOS_UDID` / `RNGMA_IOS_VERSION` into its required `--github-env` file (CI passes `$GITHUB_ENV`), which `tests:ios:run --udid`, simulator logging, WDA prebuild, and Appium then consume — local file path, consumption, and sequence: [§ prebuilt WDA](#ios-wda-prebuilt-validation). No exact match is an immediate blocker—Appium must never fabricate a simulator. The exact default or `RNGMA_IOS_APP`-configured `ReactTestApp.app` is usable only when its inner `ReactTestApp` executable is a regular file. A missing or incomplete exact app fails preflight: rebuild or correct the override rather than discovering another build or falling back to an installed app.

Before taking any e2e slot required by this task, determine whether another task owns it. If the slot is occupied and this task has no explicit ownership transfer, ask the user whether this task may take it. Without authorization, do not stop or otherwise displace the owner. Once ownership is transferred, take the slot and continue.

Ports `:8081` and `:4725` are serialized e2e resources, not the ownership rule itself. Metro used by this task on `:8081` must be **this** checkout (`RNGoogleMobileAdsExample/`), not another worktree, and the port must be free before `yarn tests:packager:reset-cache`. The canonical Appium command fails preflight if its configured listener port (`RNGMA_APPIUM_PORT`, default `:4725`) is occupied; identify the listener and stop it only when this task owns it. Never launch WDIO into an occupied Appium port. The TCP probe is an early guard that closes before Appium spawns, so a race remains; Appium startup output is authoritative and must still be watched for `EADDRINUSE`. Revert `.only` before area-focused/full.

**Startup log watch is blocking.** Read the live tee closely and continuously from command launch through preflight and Appium session creation. Do not switch to a slow polling cadence until `Execution of … workers started` appears. Most host failures are immediate: stop and diagnose on preflight rejection, `EADDRINUSE`, Appium `onPrepare` failure, `ECONNREFUSED`, or failure to create the first WebDriver session. Do not wait for the suite timeout, and do not retry until the logged cause is corrected and task-owned listeners are cleaned up.

Interrupted Shell: log footer `N passing`/`N failing` = complete. An open tee or missing footer is **not** success — inspect its startup and last output first, recover task-owned Metro/Appium resources, then re-run the **same** command only after correcting the logged cause.

<a id="e2e-diagnosis"></a>

## Diagnosis

1. Confirm [pre-flight](#pre-flight).
2. Same failure twice on the canonical command → narrow to one file or `.only` (`unit-focused` only).
3. Read `/tmp/rngma-e2e-ios-*.log` / `/tmp/rngma-e2e-android-*.log` (CI: `simulator_log` / `adb_logs` — [CI workflows](../ci-workflows/index.md)).
4. Revert `.only` and extra native logging before area-focused review or commit.

Do not invent harness override files or debug flags from other repos.

Merge: no `.only`. Pre-merge validation: [platform coverage](#platform-coverage-gate-blocking) for this diff in addition to [truthful e2e checks](../ci-workflows/index.md#e2e-continue-on-error) **and** the lint/tsc/coverage rows that [validation evidence](validation-checklist.md#validation-evidence-package) / [lint-by-tree](validation-checklist.md#lint-and-formatting) already require for this diff.
