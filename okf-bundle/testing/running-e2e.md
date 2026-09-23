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

Named scripts: `yarn tests:packager`, `yarn tests:packager:reset-cache`, `yarn tests:e2e:codegen`, `yarn tests:android:build`, `yarn tests:android:run`, `yarn tests:ios:pod:install`, `yarn tests:ios:run`, `yarn tests:appium:check`, `yarn tests:appium:release`, `yarn tests:appium:provision <android|ios|both>`, `yarn tests:appium:android`, `yarn tests:appium:ios`, `yarn tests:appium:parallel`, `yarn tests:appium:android:parallel`, `yarn tests:appium:ios:parallel`, `yarn tests:appium:android:parallel:external`, `yarn tests:appium:ios:parallel:external`, `yarn tests:appium:ios:select-and-boot`, `yarn tests:appium:ios:prebuild-wda`.

`yarn tests:e2e:codegen` generates **app-source iOS** metadata for the example and `@invertase/rngma-testing` probe before CocoaPods. [GMA-AD-3](../architecture-decisions.md#gma-ad-3) core library output is committed and skipped. Android Gradle generates the remaining app/probe metadata during its build, so Android paths do not invoke this iOS-only command or delete any generated tree. The canonical iOS run and Appium preflight invoke the same yarn target rather than duplicating its implementation. The frozen `tests:ios:pod:install` script remains exactly the bundled pod command and is called by `tests:ios:run` after codegen.

<a id="e2e-slots"></a>

## E2e slots

The pure calculator supports slots `0`–`7`. For slot `N` and platform offset `P`, `BASE = 12000 + 1000N + P`, where Android `P=0`, iOS `P=100`, and macOS `P=200`; raw platform resources use Appium `BASE+13`, automation `BASE+14`, and MJPEG `BASE+15`, while the Android console is `5556+2N` (`emulator-<console>`). Operational Metro is worktree-scoped and never platform-offset: `12000 + 1000N + 7` for both Android and iOS. Android AVDs are `TestingAVD-N`; iOS simulators are `RN E2E iOS slot-N`. The macOS offset is reserved for compatible cross-repository arithmetic; RNGMA has no macOS-app e2e target.

RNGMA operational commands accept only slots `1`, `2`, and `4`–`7`. Slot `0` remains calculator-supported but is not an RNGMA operational slot; slot `3` is reserved for RNFB. Provision, select, build, run, and Appium paths reject `0` and `3`. With `RNGMA_E2E_SLOT` unset, the serial/default behavior is unchanged: Metro `8081`, Appium `4725`, serial APK path, existing-device selection, and CI's `TestingAVD`. CI remains serial and does not use slot provisioning.

`RNGMA_E2E_SLOT` must be an unsigned integer string in `0`–`7`; operational commands then apply the RNGMA rejection above. `RNGMA_E2E_PLATFORM=android|ios` is the unified slot target: the packager requires it to validate the consumer platform, shared WDIO requires it for platform-specific service ports (Appium preflight supplies its own target), and every slot-aware platform-specific command rejects a conflicting value instead of ignoring or overriding it. When a slot is selected, computed ports win: `RNGMA_METRO_PORT` may equal only the worktree port, while `RNGMA_APPIUM_PORT` may equal only the platform-specific port; different explicit values are rejected. A conflicting `RNGMA_ANDROID_UDID` or `RNGMA_IOS_DEVICE` is also rejected. `RNGMA_IOS_UDID` and `RNGMA_IOS_VERSION` may further constrain the exact slot-named simulator selected by the iOS selector. With no slot, the platform variable does not change serial resources.

**Create-only provisioning.** Before first use of a missing slot device, run exactly one of:

```bash
RNGMA_E2E_SLOT=<1|2|4-7> yarn tests:appium:provision <android|ios|both>
```

The command reuses an available exact existing name and otherwise creates it. It never deletes, erases, renames, overwrites, or repairs any device—even when an existing exact-name AVD has an incompatible ABI. For a missing Android AVD, local slot provisioning installs the API 36 `google_apis` image matching the Node host (`arm64-v8a` on `arm64`, `x86_64` on `x64`) and creates `TestingAVD-N`; any other host architecture is rejected before inventory or mutation. iOS creates an exact iPhone 17 on the newest available installed iOS runtime. Provisioning requires a slot and rejects `0` and `3`. A single-platform argument must match `RNGMA_E2E_PLATFORM` when that variable is set; `both` requires it unset. Those rejections happen before inventory or create. Appium and `ios:select-and-boot` remain select-and-boot only: they never create a device. A missing exact device is a blocker until this provisioning command succeeds.

**Operator check/release.** Use `yarn tests:appium:check` before taking serial resources, or add `--slot=N`; `RNGMA_E2E_SLOT` is equivalent. `--platform=android|ios` scopes a platform. For slotted worktree Metro, add `--metro-owner-slot=N` (or set `RNGMA_E2E_METRO_SLOT`) so checks identify the actual first-slot listener. Consumer slots inspect that shared listener but never own or release it. Slotted release may stop Metro only when both the selected slot and `--metro-owner-slot` identify the owner; omitting owner scope omits Metro entirely. Default host-clear treats Metro and the Android emulator console as informational, while `--services` (alias `--strict`) includes them as BUSY. Appium, automation, MJPEG, the example app, and the exact booted device are always BUSY. Add `--devices` to stop the exact scoped emulator/simulator. `--only=<comma-separated categories>` narrows release to `metro`, `appium`, `android-apps`, `android-emulator`, and/or `ios-sims`. `--all-slots` is a dedicated-host action over serial plus slots `1`, `2`, and `4`–`7`; it never includes reserved slot `3` or Detox-clone simulators, and it does not infer or multiply Metro ownership. Supply one explicit `--metro-owner-slot=N` when that whole-worktree Metro is intentionally in scope. Both commands reject slots `0` and `3` before probing or changing the host.

**Canonical slot 1 Android sequence** (one shell per long-lived owner is normal):

```bash
RNGMA_E2E_SLOT=1 RNGMA_E2E_PLATFORM=android yarn tests:packager
RNGMA_E2E_SLOT=1 RNGMA_E2E_PLATFORM=android yarn tests:android:build
RNGMA_E2E_SLOT=1 RNGMA_E2E_PLATFORM=android yarn tests:appium:android
```

These use Metro `13007`, Appium `13013`, AVD `TestingAVD-1`, and `emulator-5558`. The packager owner keeps Metro alive; the build owner runs codegen and Gradle; the Appium owner selects or boots only the exact existing AVD, owns the Appium listener, verifies connectivity, and runs WDIO. Slot-mode Android Appium preflight may read global `adb devices` inventory, but it computes the expected slot serial first; every device-targeted `adb -s` query or action is scoped only to that serial. A missing exact serial boots the exact AVD without probing other devices. Serial mode still selects among connected devices by API. `tests:android:build` passes the real Gradle property `-PreactNativeDevServerPort=13007`, then copies the resulting APK to `RNGoogleMobileAdsExample/android/app/build/outputs/apk/debug/slots/slot-1/app-debug.apk`; Appium selects that slot path. With no slot, Gradle and `RNGoogleMobileAdsExample/android/app/build/outputs/apk/debug/app-debug.apk` remain unchanged. Named `tests:android:run` in slot mode still validates or boots that exact AVD+serial, then proves selected-serial Metro reverse **and** that the device can reach this checkout's Metro — keep that guard; CLI reverse can warn while the tunnel is already correct. It then uses example CLI **20.2** `react-native run-android --device <exact serial> --binary-path <slot APK> --no-packager --port <worktree Metro>` so the existing slot binary is installed and launched on that serial only, without starting another Metro. Raw slot `adb install` and activity launch are gone. Serial mode still uses the existing RN CLI `android` script (no slot `--device` form). Appium install/reset/`debug_http_host`/activate is unchanged.

**Canonical slot 1 iOS sequence:**

```bash
RNGMA_E2E_SLOT=1 RNGMA_E2E_PLATFORM=ios yarn tests:packager
RNGMA_E2E_SLOT=1 RNGMA_E2E_PLATFORM=ios yarn tests:appium:ios:select-and-boot --github-env /tmp/rngma-ios-slot-1-env
set -a; . /tmp/rngma-ios-slot-1-env; set +a
RNGMA_E2E_SLOT=1 RNGMA_E2E_PLATFORM=ios yarn tests:ios:pod:install
RNGMA_E2E_SLOT=1 RNGMA_E2E_PLATFORM=ios yarn tests:ios:run --udid "$RNGMA_IOS_UDID"
RNGMA_E2E_SLOT=1 RNGMA_E2E_PLATFORM=ios yarn tests:appium:ios:prebuild-wda
RNGMA_E2E_SLOT=1 RNGMA_E2E_PLATFORM=ios yarn tests:appium:ios
```

Use a fresh writable env file because selection appends. The packager owner keeps worktree Metro `13007` alive; the selector owner selects and boots only `RN E2E iOS slot-1` and emits its UDID/runtime; slot `tests:ios:run --udid` requires those selector variables, verifies the exact slot name and runtime, and rejects an arbitrary or serial UDID **before** build or install; the named pod/build/run path then installs on that UDID and passes `RCT_METRO_PORT=13007` as an explicit Xcode build setting; WDA is rebuilt in the shared `tooling/appium/.wda-derived`; and the Appium owner uses platform-specific listener `13113`, the same selection, app, and prebuilt WDA. XCUITest launches the app with `-RCT_jsLocation localhost:13007` and `RCT_METRO_PORT=13007`, so native launch and build target the same worktree Metro. Slot ownership is per nonreserved slot: the manual sequence supports one Android or iOS session in each operational slot; the parallel owner below selects exactly three. Serial operation remains one e2e at a time on `8081`/`4725`.

<a id="parallel-appium"></a>

### Parallel Appium (local only)

The preferred simultaneous Android+iOS command is:

```bash
RNGMA_E2E_PARALLEL_SLOTS=1,4,6 yarn tests:appium:parallel
```

This combined owner starts one worktree Metro and waits for readiness **before** either platform prepares. Android and iOS preparation then run concurrently. A cross-platform barrier waits for both preparations to succeed before synchronously launching all six Appium children, so neither platform can enter its session phase early. One platform's preparation/session failure, an unexpected Metro exit, or abort cancels the sibling platform and the one Metro through shared once-only cleanup. The two platform summaries each retain total `25` and positional `15 + 6 + 4` rows.

Single-platform parents use:

```bash
yarn tests:appium:android:parallel
yarn tests:appium:ios:parallel
```

Set `RNGMA_E2E_PARALLEL_SLOTS` to exactly three comma-separated operational slots when the defaults are unsuitable. Pairing is positional: first/second/third map to `a-primary` (15), `b-secondary` (6), and `c-tertiary` (4). The product default remains `1,2,4`; for a host where those slots are not all owned, select only owned slots, for example:

```bash
RNGMA_E2E_PARALLEL_SLOTS=1,4,5 yarn tests:appium:android:parallel
```

The aggregate is **15 + 6 + 4 = 25 tests**, not 75. Parsing rejects a count other than three, empty/malformed values, duplicates, slot `0`, reserved slot `3`, out-of-range slots, and conflicting slot/platform/port child environment. Do not set internal spec-filter, parent/child, or Metro-slot variables and do not invoke the workspace implementation directly. Existing serial commands and the manual per-slot sequence above are unchanged.

Before first device use, the exact devices for all three slots must already exist. Provision missing devices with the create-only command, once per slot:

```bash
RNGMA_E2E_SLOT=1 yarn tests:appium:provision android
RNGMA_E2E_SLOT=4 yarn tests:appium:provision android
RNGMA_E2E_SLOT=5 yarn tests:appium:provision android
RNGMA_E2E_SLOT=1 yarn tests:appium:provision ios
RNGMA_E2E_SLOT=4 yarn tests:appium:provision ios
RNGMA_E2E_SLOT=5 yarn tests:appium:provision ios
```

Run only the three commands for the platform being prepared. This `1,4,5` example creates or reuses exact `TestingAVD-1`, `TestingAVD-4`, and `TestingAVD-5`, or exact `RN E2E iOS slot-1`, `slot-4`, and `slot-5`; it never deletes, erases, renames, or overwrites devices. Other operational slot triples, including the product default, remain supported. The parallel command remains select-and-boot only and fails when an exact device is missing. Before taking the slots, apply the ownership-transfer rule in [pre-flight](#pre-flight). The task must own all three slots and every required listener must be free before the orchestrator mutates codegen, files, builds, simulators, or child processes.

Android resources are:

- slot `1`: Appium `13013`, UiAutomator2 `systemPort` `13014`, MJPEG `13015`, `TestingAVD-1` / `emulator-5558`;
- slot `4`: Appium `16013`, UiAutomator2 `systemPort` `16014`, MJPEG `16015`, `TestingAVD-4` / `emulator-5564`.
- slot `5`: Appium `17013`, UiAutomator2 `systemPort` `17014`, MJPEG `17015`, `TestingAVD-5` / `emulator-5566`.

iOS resources are:

- slot `1`: Appium `13113`, XCUITest `wdaLocalPort` `13114`, MJPEG `13115`, `RN E2E iOS slot-1`;
- slot `4`: Appium `16113`, XCUITest `wdaLocalPort` `16114`, MJPEG `16115`, `RN E2E iOS slot-4`.
- slot `5`: Appium `17113`, XCUITest `wdaLocalPort` `17114`, MJPEG `17115`, `RN E2E iOS slot-5`.

The first configured slot identifies one worktree Metro at `12000 + slot*1000 + 7`, without a platform offset. With `1,4,5`, every Android and iOS child uses `13007`; Appium, automation, MJPEG, devices, and copied app artifacts remain slot- and platform-specific. A normal single-platform parent checks that shared port once, serializes preparation, starts exactly one task-owned Metro, waits for it, then starts three Appium/WDIO children. Android preparation runs one Gradle build for that first configured slot / common Metro, then copies the same canonical debug APK to every planned slot path; a copy failure prevents Appium session launch ([§ Android app path](#android-app-path)). Each serial-scoped reverse, debug host, install, and launch uses that common port.

The iOS command runs app-source iOS Codegen once. It requires the frozen root Ruby bundle to be installed first (`BUNDLE_FROZEN=true bundle install`). It serially selects/boots the configured slots into fresh per-slot environment files, requires all exact simulators to resolve to the same installed iOS runtime, then serially builds/installs each app. Each build and XCUITest launch receives the common `RCT_METRO_PORT` / `-RCT_jsLocation`, while copied apps remain under `RNGoogleMobileAdsExample/ios/build/slots/slot-N/ReactTestApp.app`. One shared WDA prebuild runs against the first selection.

**Advanced/manual simultaneous contract.** The combined command above is preferred because its barrier guarantees concurrent Appium launch. The explicit external-consumer flow remains available when an operator needs separate parent processes; neither parent may opportunistically attach to a busy port. Use three shells so the owner remains foregrounded and both consumers overlap:

Shell A — start the explicit owner, wait for Metro's ready message, and leave this shell running:
```bash
RNGMA_E2E_SLOT=1 RNGMA_E2E_PLATFORM=android yarn tests:packager
```

Shell B — after Shell A is ready:
```bash
RNGMA_E2E_PARALLEL_SLOTS=1,4,5 yarn tests:appium:android:parallel:external
```

Shell C — start after Shell A is ready, without waiting for Shell B:
```bash
RNGMA_E2E_PARALLEL_SLOTS=1,4,5 yarn tests:appium:ios:parallel:external
```

Wait for both Shell B and Shell C to exit. Only then return to Shell A and interrupt its foreground named packager with Ctrl-C. The external parents require `13007` to be listening before any preparation and again before Appium, never start or stop it, and own only their platform-specific children. The standalone owner is the only process allowed to bind or stop Metro and therefore outlives both consumers without ad-hoc process discovery or cleanup.

Each invocation creates a new `/tmp/rngma-e2e/<invocation-id>/` tree; it never truncates evidence from an earlier invocation. The tree holds `metro.log`, one platform/slot/label child log per Appium stream, and exact-device startup logs. Parallel summaries print the invocation ID and log root, and each result row retains slot/spec/tests/status/numeric exit/log. Startup failure and cleanup semantics are canonical in [§ enforced startup supervision](#enforced-startup-supervision). A successful run prints all three passing rows and total `25`, then an owner parent stops its one Metro; an external parent never does. Release interrupted slots individually; release the shared Metro only from its explicit owner slot scope.

These parallel commands are local-only. GitHub Actions remains on the serial commands and serial `8081`/`4725` resources documented in [CI workflows](../ci-workflows/index.md#workflows).

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

The long-running named owners preserve their own invocation-unique logs under the printed `/tmp/rngma-e2e/<invocation-id>/` root. Redirect/`tee` of the **same** named yarn script to an additional unique operator-selected path remains allowed; do not add other wrappers.

Device driver: Appium 3 + WebdriverIO in `tooling/appium/` ([§ Appium](#appium-scaffold)). Specs: `tooling/appium/test/specs/**/*.ts`. App: `RNGoogleMobileAdsExample/` (format gallery + stable `testID`s). Serial operation is one e2e at a time on `:8081`; manual slot operation is one session per supported nonreserved slot; a single-platform parallel owner runs three positionally mapped one-worker sessions on the three configured slots, while the preferred combined owner runs six (three per platform) after the documented session barrier ([§ parallel Appium](#parallel-appium)). No source edits during a run.

There is no separate macOS-app e2e target. iOS e2e is `yarn tests:ios:pod:install` / `yarn tests:ios:run` (install) then `yarn tests:appium:ios` (local Mac or CI `macos-15`; the required WDA prebuild comes first: [§ prebuilt WDA](#ios-wda-prebuilt-validation)).

GitHub Actions fails when the app install or Appium suite fails; artifact uploads remain unconditional. Local gates still require counts plus the printed invocation log root (or an additional unique tee), or triaged `simulator_log` / `adb_logs`.

<a id="appium-scaffold"></a>

## Appium

Private workspace `@invertase/rngma-appium` at `tooling/appium/` (Yarn workspace `tooling/*`; not a Lerna publish package). Stack: Appium 3 + WebdriverIO + UiAutomator2 + XCUITest. Broad **navigation/container smoke** samples representative **Banner** + **Collapsible Banner**, listed GAM banner sizes (**AnchoredAdaptiveBanner**, **Fluid**), plus interstitial / rewarded / rewarded interstitial / app open / native / GAM interstitial, and hooks / consent / inspector / debug seams; it does not claim those ads loaded. Remaining banner size variants stay reachable via the gallery accordion (manual QA).

<a id="representative-acceptance"></a>

Four separate Google-test-ID **request-outcome contracts** cover standard Banner auto-load, Native promise settlement, Interstitial after **Load** (never Show), and GAM Interstitial after **Load** (never Show). This section owns the acceptance rule; other docs link here instead of restating it.

**Accepted outcome (settled).** Every representative session runs at most **ten fresh request attempts** and **stops immediately on the first accepted outcome** — remaining attempts are never taken. The default accepted outcome, for every format on both platforms, is `loaded`. **Android Native only** additionally accepts an `internal-error` attempt whose request-scoped `fingerprint.status` is exactly `matched`; that acceptance also stops the session immediately. Every other terminal outcome — `no-fill`, `internal-error` that is `not-matched` or `unavailable`, and `other-error` — is a **retry**. Retry backoff before attempts two and up is 250 ms, 500 ms, 1000 ms, then capped at 2000 ms. A session that reaches attempt ten without an accepted outcome **hard-fails** the format with a deterministic diagnostic carrying every attempt's `attempt`, `requestId`, `classification`, and `fingerprint`. A missing outcome marker, a timeout or other non-terminal wait, a missing, reused, or non-increasing monotonic `requestId`, or any other WebDriver / navigation / container / probe / seam failure **hard-fails immediately** — those never consume a retry.

Fresh-request mechanics: Banner auto-loads on open then taps **Reload**; Native remounts by returning to the gallery and re-opening the format; Interstitial / GAM Interstitial tap **Load** each attempt. Show is never tapped. Unique, increasing `requestId` values prove Native remounts issued a new request; a duplicate or non-increasing id fails.

Every attempt emits one stable `[request-outcome-attempt]` JSON line with `format`, `platform`, `attempt`, `requestId`, `classification`, `detail`, and `fingerprint` (`status` + `evidence`). Android Native `internal-error` fingerprints only when the request-scoped logcat window (cleared before each Native request) contains the exact Ads lines `<Google:HTML> Incorrect native ad response. Click actions were not properly specified` and `Ad failed to load : 0` **adjacent in the raw chronological stream**. Blank, whitespace, malformed, or other non-Ads interleaving rejects the match; a single trailing newline is file termination, not an intervening line. Same PID, that order, within 250 ms. iOS reports fingerprint capability `unavailable` if Native `internal-error` occurs (no request-scoped SDK-log window). Other classifications use `not-applicable`. An accepted `loaded` Banner or Native attempt also emits one `[render-proof]` JSON line: both record `format`, `platform`, and the actual measured rectangle(s); Banner additionally records the displayed nonzero descendant rectangle and its native type. The tertiary probe emits one `[probe-seam]` JSON line with `platform` and the exact asserted `action.loaded` status string. Those lines are log evidence of the assertions, not table cells — do not copy measurements, status strings, run IDs, log paths, dates, device IDs, or durations into this document. Representative sessions do **not** wrap in instrumentation-crash recovery; those failures fail the suite. The example derives `no-fill` from the structured v17 ad-error reason across banner callbacks, native promise rejection, and fullscreen events rather than matching message prose. Device-free validation drives the same orchestration, locks the whole acceptance matrix (every path × platform × classification × fingerprint status), locks the render-proof and probe-seam wiring, and rejects Show actions. The counts behind the settled rule: [§ request-outcome sample](#request-outcome-sample).

**Accepted-load render proof.** An accepted `loaded` outcome must also prove an actual rendered view, not just the outcome marker, before the session returns to the gallery. **Banner** asserts the `<format>.rendered` wrapper (a `collapsable={false}` `View` around `<BannerAd>`) is displayed with a nonzero rectangle **and** holds at least one displayed native descendant with a nonzero rectangle. **Native** asserts the `NativeAdView` carrying `gma.format.native.rendered` is displayed with a nonzero rectangle. A missing element, a zero rectangle, or a banner wrapper without a qualifying descendant fails the format. **Interstitial** and **GAM Interstitial** are fullscreen, **Load-only**, and never shown, so they carry no render proof. The Android Native matched-fingerprint acceptance is not a load and has no creative, so it skips the render assertion.

**Session split and restart policy:** Device smoke runs as **three** WDIO sessions (`formats.smoke.a-primary` / `b-secondary` / `c-tertiary`, lists in `tooling/appium/src/formats.ts`). Android UiAutomator2 tends to destabilize after roughly fifteen tests in one session; the split keeps each session shorter. Within a session, cases return to the section-filtered gallery and run back-to-back. A cold app restart is opt-in only for a format with demonstrated isolated-state needs. Navigation/container smoke may restart once after an instrumentation crash; representative request-outcome sessions do not. iOS uses the same three-spec layout for parity. Every iOS session targets the same preflight-selected simulator UDID; more than one `appiumTest-*` simulator is always a leak/bug, never expected split-session behavior.

**Pins:** JS deps in `tooling/appium/package.json` + `yarn.lock`. Driver versions are **also** pinned in checked-in `tooling/appium/drivers.manifest.json` (Appium drivers are not fully guaranteed by the lockfile alone). Install into gitignored `tooling/appium/.appium-home/` (`APPIUM_HOME`) with `yarn tests:appium:drivers:install`, then `yarn tests:appium:drivers:verify`. Device-free config and host-preflight helper tests: `yarn tests:appium:validate`. Device runs: `yarn tests:appium:android` / `yarn tests:appium:ios`. iOS `appium:wdaLaunchTimeout` is 300s and the iOS WDIO connection timeout is longer so WDIO cannot SIGTERM a live WDA `xcodebuild`. Example UI uses stable `testID`s from `RNGoogleMobileAdsExample/src/appiumTestIds.ts` (mirrored in `tooling/appium/src/testIds.ts`).

**Probe TurboModule (Pattern C):** Example-only `@invertase/rngma-testing` (`portal:./modules/rngma-testing`) exposes `NativeRNGMATesting` (codegen + Android/iOS). Seed seams for delayed banner attach, debug inventory TTL, and ResponseInfo fixture JSON — not product package code. Product ResponseInfo serialization fixtures live under `packages/core/__tests__/fixtures/responseInfo/` (`loaded` / `no-fill` / `paid-compact`) and are asserted by Jest; native serializers attach the same shape on fullscreen/banner/native-ad load, load-error, and compact paid paths. Debug gallery entry `gma.format.native-rngma-testing` exercises `ping()`, probe fixtures, and public `AdPools.create` lifecycle coverage (start, availability, poll, peek, destroy); tertiary Appium smoke opens it and asserts the `action.loaded` status contains every deterministic seam marker: the platform ping (`ok ping=ok:android` on Android, `ok ping=ok:ios` on iOS), `ttl=60000` for the set override, `cleared=-1` for the cleared override, `attach=true`, and `fixtures=fixture-loaded-response,null,fixture-paid-response` (the three fixture response IDs, `no-fill` carrying none). The same status line also reports `pool=`, which is runtime-variable and deliberately not asserted as an exact marker. Use Yarn `portal:` (not `file:`) so native edits stay linked into `node_modules`. On a virgin iOS tree, if `<ReactCodegen/RNGMATestingSpec/…>` headers are missing after the first codegen, re-run `yarn tests:ios:pod:install` once so Public headers land, then `yarn tests:ios:run`.

**Gallery sections:** The example home screen filters with **All | Formats | Hooks | Debug** chips (`gma.gallery.section.*`). Appium helpers select the section that contains a format before opening it so deep `UiScrollable` targets (hooks at the bottom of **All**) are not required. Manual QA still uses **All** (or each section) to reach every format.

**Native coverage flush:** After each top-level smoke suite, while the Appium session is still alive, WDIO taps home **Flush coverage** (`gma.debug.flushCoverage`) so `react-native-coverage` `flush()` dumps Emma/LLVM (and Istanbul when Metro is instrumented) before process kill. Agent pull/report/assert: [coverage design § native agent collection](coverage-design.md#native-agent-collection).

<a id="android-app-path"></a>

**Android app path:** default `RNGoogleMobileAdsExample/android/app/build/outputs/apk/debug/app-debug.apk` after `yarn tests:android:build` (override `RNGMA_ANDROID_APK`). With a slot, the same named build passes the computed worktree Metro port as Gradle's real `reactNativeDevServerPort`. A manual single-slot build copies that canonical debug APK to `RNGoogleMobileAdsExample/android/app/build/outputs/apk/debug/slots/slot-N/app-debug.apk` for the selected slot only. Parallel Android prep ([§ parallel Appium](#parallel-appium)) runs that named build once for the first configured slot / common worktree Metro, then copies the same output to every planned slot path; a copy failure prevents Appium session launch. Appium selects the matching slot path unless `RNGMA_ANDROID_APK` explicitly overrides it. Named slot `tests:android:run` installs that existing slot APK through CLI 20.2 `--binary-path` / `--no-packager` on the exact serial ([§ e2e slots](#e2e-slots)); it does not rebuild. Appium install/reset may clear app data; the named Android Appium command restores React Native `debug_http_host=127.0.0.1:<worktree-Metro-port>` after that reset and launches afterward. Do not invent ad hoc `adb` / SharedPreferences / launch steps. Metro reverse and connectivity use the same computed port for the selected serial ([pre-flight](#pre-flight)). **iOS:** `yarn tests:ios:run --udid <selected-udid>` runs codegen, the exact frozen bundled pod script, and `react-native build-ios --buildFolder build`, then installs and launches `RNGoogleMobileAdsExample/ios/build/Build/Products/Debug-iphonesimulator/ReactTestApp.app` on that simulator with `simctl`; Appium uses the same exact path. Slot mode also requires selector-produced `RNGMA_IOS_UDID` / `RNGMA_IOS_VERSION`, matches `--udid` to that UDID, and verifies the exact slot simulator name and runtime before those steps. Slot builds add explicit Xcode setting `RCT_METRO_PORT=<worktree-Metro-port>`, and XCUITest supplies `-RCT_jsLocation localhost:<same-port>` plus that environment value at launch. Serial builds and launches add neither, preserving prior behavior. Set `RNGMA_IOS_APP` only to explicitly override Appium. Never discover an app from DerivedData or fall back to an installed bundle id.

<a id="request-outcome-sample"></a>

## Request-outcome sample

Cumulative aggregate from the [request-outcome contracts](#appium-scaffold) above. It is durable because these counts are the input that selected the [settled acceptance rule](#representative-acceptance) each format now holds — see [documentation policy § cumulative verification-evidence tables](../documentation-policy.md#verification-evidence-tables) for why counts live here and why logs, run identifiers, and dates do not.

**Lower bound, not a census.** Every cell counts only attempts whose classification is verified and non-overlapping across sessions, so totals only ever grow. Absence of a count is not evidence that an outcome cannot occur. Every subsequent qualifying run feeds this sample. The published table is the snapshot at the last implementation or documentation pass before independent review; runs taken while that tree is frozen accumulate for the next permitted documentation pass and do not mutate the table under review. The four request-outcome contracts live only in `formats.smoke.a-primary`; the second and third configured slots run `b-secondary` / `c-tertiary` and do not run them (slots `4` / `5` in the `1,4,5` example; [§ parallel Appium](#parallel-appium)).

| format | platform | attempts | loaded | no-fill | internal-error(fingerprinted) | other-error | current-acceptance |
|--------|----------|----------|--------|---------|-------------------------------|-------------|--------------------|
| Banner | android | 21 | 21 | 0 | 0 | 0 | `loaded` (+ render proof) |
| Banner | ios | 12 | 12 | 0 | 0 | 0 | `loaded` (+ render proof) |
| Native | android | 185 | 1 | 0 | 142 (+42 unfingerprinted) | 0 | `loaded` (+ render proof) or `matched` fingerprint |
| Native | ios | 12 | 12 | 0 | 0 | 0 | `loaded` (+ render proof) |
| Interstitial | android | 22 | 22 | 0 | 0 | 0 | `loaded` (Load-only) |
| Interstitial | ios | 12 | 12 | 0 | 0 | 0 | `loaded` (Load-only) |
| GAM Interstitial | android | 23 | 21 | 2 | 0 | 0 | `loaded` (Load-only) |
| GAM Interstitial | ios | 12 | 12 | 0 | 0 | 0 | `loaded` (Load-only) |

`internal-error(fingerprinted)` counts only attempts whose structured fingerprint is `matched` under the raw-stream adjacency contract above. `(+N unfingerprinted)` are collector `internal-error` attempts that are not `matched` (no signature; blank, whitespace, malformed, or other non-Ads interleaving; signature without the adjacent same-PID failure; or iOS `unavailable`); they are real internal errors and are not counted as fingerprinted. Outcome columns sum to `attempts` in each row (`142 (+42)` is 184, plus one loaded Native attempt is 185). Total attempts across rows: 299.

That Native signature is Google serving a malformed native creative, not a local defect: it reproduced on API 29 **and** API 36 `google_apis`, and with both `TestIds.NATIVE` and `GAM_NATIVE`, so it is neither emulator-image- nor ad-unit-specific. The same Native contract has also loaded, and the official GAM interstitial test unit has returned `no-fill` twice in a session where the standard Interstitial loaded. Exactly one of those intermittent server-side outcomes is tolerated by the settled rule: the `matched` Android Native fingerprint.

**Sufficiency, and no top-up.** The 287 collect-mode attempts that preceded this snapshot were sufficient to settle acceptance; no further collection run is required. Every format/platform pair has already produced the outcome its rule requires, and Android Native has produced both the `matched` malformed-creative fingerprint and a `loaded` attempt, so each rule is known to be satisfiable on a real device. That is a harness decision about which contract the suite can hold — not a statistical claim about the population of ad-server responses, and not a prediction of per-attempt fill rates. Qualifying proof runs after that decision only raise the lower-bound counts (299 here); they do not reopen collection.

**No `no-fill` waiver for GAM Interstitial.** The two `no-fill` attempts are attempt-level outcomes inside sessions that went on to succeed; they do not show a full ten-attempt session exhausting without an accepted outcome, which is the only evidence that would justify accepting `no-fill`. Until such an exhausted session is observed, `no-fill` stays a retry and an exhausted session hard-fails with the diagnostic above.

`current-acceptance` is the **settled** per-row rule, defined once in [§ Appium](#representative-acceptance); do not restate its mechanics here. The outcome columns remain **lower-bound historical evidence** (collect-mode sessions plus later qualifying proof runs): they explain how the rule was chosen and that proof sessions satisfied it. The acceptance column does not change when counts grow; only new qualifying runs move the counts, under the snapshot-boundary in **Lower bound, not a census** above.

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

Prefer `yarn tests:appium:check` with matching `--slot` / `--platform` over ad-hoc listener probes. Use scoped `yarn tests:appium:release` only after ownership is established; [operator semantics](#e2e-slots).

Before Android Appium, inventory AVDs with `emulator -list-avds`. Serial mode preflights connected devices, deterministically prefers API 36, passes its selected serial to WDIO, and verifies that serial's computed Metro reverse **and** that the device can connect through it to this checkout's Metro. Slot-mode Android isolation (expected serial first; every `adb -s` query/action only on that serial; missing exact serial boots the exact AVD without probing others): [§ e2e slots](#e2e-slots). Named slot `tests:android:run` keeps that same reverse/connectivity proof before CLI 20.2 `--device` launch because CLI reverse can warn. Do not invent a separate `adb reverse`, omit `--device`, invoke the CLI outside that yarn script, or run `installDebug`. Missing exact slot device: use the create-only [provisioning command](#e2e-slots); Appium never creates it. Session launch after Appium install/reset: [§ Android app path](#android-app-path). CI Android e2e remains serial on `TestingAVD`, `8081`, and `4725`, using API 36 `google_apis` x86_64 (Play services, no Play Store login). UiAutomator2 requires Android 8+ (API 26): boot the reported qualifying AVD and retry the same command, never retry API 24. Before iOS Appium, preflight inventories `xcrun simctl list devices available`, selects an **existing exact name** by UDID (`iPhone 17` serially or `RN E2E iOS slot-N` for a slot), and passes that UDID to every WDIO session. It prefers an already booted exact match, then the newest available runtime; `RNGMA_IOS_VERSION` constrains the runtime without a checked-in version pin, and an explicit `RNGMA_IOS_UDID` must resolve to an available exact-name match. The named selector opens each iOS device pass, because the required WDA prebuild consumes its variables: it boots that exact simulator and records `RNGMA_IOS_UDID` / `RNGMA_IOS_VERSION` into its required `--github-env` file (CI passes `$GITHUB_ENV`), which `tests:ios:run --udid`, simulator logging, WDA prebuild, and Appium then consume — local file path, consumption, and sequence: [§ prebuilt WDA](#ios-wda-prebuilt-validation). No exact match is an immediate blocker—use the create-only provisioning command for a slot; Appium and the selector never fabricate a simulator. The exact default or `RNGMA_IOS_APP`-configured `ReactTestApp.app` is usable only when its inner `ReactTestApp` executable is a regular file. A missing or incomplete exact app fails preflight: rebuild or correct the override rather than discovering another build or falling back to an installed app.

Before taking any e2e slot required by this task, determine whether another task owns it. If the slot is occupied and this task has no explicit ownership transfer, ask the user whether this task may take it. Without authorization, do not stop or otherwise displace the owner. Once ownership is transferred, take the slot and continue.

Serial ports `:8081` and `:4725`, or the selected slot's computed Metro/Appium ports, are e2e resources, not the ownership rule itself. Metro must be **this** checkout (`RNGoogleMobileAdsExample/`), and its selected port must be free before `yarn tests:packager:reset-cache`. The canonical Appium command fails preflight if its selected listener port is occupied; identify the listener and stop it only when this task owns it. Never launch WDIO into an occupied Appium port. The TCP probe is an early guard that closes before Appium spawns, so a race remains; the startup supervisor below treats Appium's later `EADDRINUSE` output as authoritative. Revert `.only` before area-focused/full.

<a id="enforced-startup-supervision"></a>

### Enforced startup supervision

The long-running owners enforce startup themselves: standalone Metro; serial or manual-slot Android/iOS Appium; single-platform owner or external-consumer parallel; and combined parallel. Startup advances only through these positive barriers:

1. **Metro — 120 seconds:** task-owned Metro requires both its TCP listener and `Dev server ready`. An external consumer requires the already-supervised named Metro owner to be listening and monitors that listener through startup.
2. **Worker/session — 60 seconds:** every Appium child must emit both WDIO worker-start evidence (`Execution of … workers started`) and evidence that its WebDriver/Appium session was created.
3. **App — 120 seconds:** every child must emit `[e2e-startup-ready]`; each smoke spec emits it only after `waitForGalleryHome()` succeeds.

During those phases, determinative hard markers abort immediately instead of waiting out the ceiling. The shared registry covers Metro transform/React bootstrap failures, wrong-target or preflight rejection, listener/connectivity failures, Appium prepare/session-creation failures, premature owner/child exit, and loss of external Metro health. It deliberately does **not** classify ordinary ad-serving outcomes (`no-fill` or representative `internal-error`), ordinary load latency, stale-element warnings, Watchman recrawl, or Gradle `UP-TO-DATE` as startup failures.

After every child's worker and session positives, device startup diagnostics tail only the exact target. Android uses the selected serial with no history (`-T 0`) and the tag allowlist `ReactNative:V ReactNativeJS:V AndroidRuntime:E *:S`; device-sourced lines can trigger only the bundle/connectivity hard markers. iOS uses the selected UDID and filters to `ReactTestApp`. Global or unrelated-device tails are forbidden. Each owner writes a fresh `/tmp/rngma-e2e/<invocation-id>/` tree and prints its invocation ID and paths; a later invocation never replaces that evidence.

Failure or interruption aborts the owned process tree once. The owner sends SIGTERM, escalates remaining processes to SIGKILL after 5 seconds, and drains its owned children before printing summaries or exiting; the drain ceiling is 30 seconds, after which residual PIDs are reported explicitly.

**Boundary:** build, Codegen, CocoaPods, device selection/install, and WDA prebuild steps are not covered by these startup phase ceilings. A silent stalled Gradle or `xcodebuild`/pod step remains operator-visible and must be diagnosed rather than mistaken for a supervised wait.

Operator watching is residual, not the startup mechanism: keep the foreground named owner visible, especially during uncovered preparation steps, and act on diagnostics the owner reports. Do not retry until the logged cause is corrected and task-owned listeners are cleaned up.

Interrupted Shell: log footer `N passing`/`N failing` = complete. An open tee or missing footer is **not** success — inspect its startup and last output first, recover task-owned Metro/Appium resources, then re-run the **same** command only after correcting the logged cause.

<a id="e2e-diagnosis"></a>

## Diagnosis

1. Confirm [pre-flight](#pre-flight).
2. Same failure twice on the canonical command → narrow to one file or `.only` (`unit-focused` only).
3. Read the printed `/tmp/rngma-e2e/<invocation-id>/` tree or additional unique tee (CI: `simulator_log` / `adb_logs` — [CI workflows](../ci-workflows/index.md)).
4. Revert `.only` and extra native logging before area-focused review or commit.

Do not invent harness override files or debug flags from other repos.

Merge: no `.only`. Pre-merge validation: [platform coverage](#platform-coverage-gate-blocking) for this diff in addition to [truthful e2e checks](../ci-workflows/index.md#e2e-continue-on-error) **and** the lint/tsc/coverage rows that [validation evidence](validation-checklist.md#validation-evidence-package) / [lint-by-tree](validation-checklist.md#lint-and-formatting) already require for this diff.
