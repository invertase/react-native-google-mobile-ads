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

Named scripts: `yarn tests:packager`, `yarn tests:packager:reset-cache`, `yarn tests:e2e:codegen`, `yarn tests:android:build`, `yarn tests:android:run`, `yarn tests:ios:pod:install`, `yarn tests:ios:run`, `yarn tests:appium:provision <android|ios|both>`, `yarn tests:appium:android`, `yarn tests:appium:ios`, `yarn tests:appium:android:parallel`, `yarn tests:appium:ios:parallel`, `yarn tests:appium:ios:select-and-boot`, `yarn tests:appium:ios:prebuild-wda`.

`yarn tests:e2e:codegen` always generates native metadata for **both Android and iOS** (`react-native codegen --platform all`), then removes only the transient Android app codegen tree that would create duplicate CMake targets. The canonical Android build/run and iOS run scripts invoke it before native work; Appium preflight invokes the same yarn target rather than duplicating its implementation. The frozen `tests:ios:pod:install` script remains exactly the bundled pod command and is called by `tests:ios:run` after codegen.

<a id="e2e-slots"></a>

## E2e slots

The pure calculator supports slots `0`–`7`. For slot `N` and platform offset `P`, `BASE = 12000 + 1000N + P`, where Android `P=0`, iOS `P=100`, and macOS `P=200`; Metro is `BASE+7`, Appium is `BASE+13`, and the Android console is `5556+2N` (`emulator-<console>`). Android AVDs are `TestingAVD-N`; iOS simulators are `RN E2E iOS slot-N`. The macOS offset is reserved for compatible cross-repository arithmetic; RNGMA has no macOS-app e2e target.

RNGMA operational commands accept only slots `1`, `2`, and `4`–`7`. Slot `0` remains calculator-supported but is not an RNGMA operational slot; slot `3` is reserved for RNFB. Provision, select, build, run, and Appium paths reject `0` and `3`. With `RNGMA_E2E_SLOT` unset, the serial/default behavior is unchanged: Metro `8081`, Appium `4725`, serial APK path, existing-device selection, and CI's `TestingAVD`. CI remains serial and does not use slot provisioning.

`RNGMA_E2E_SLOT` must be an unsigned integer string in `0`–`7`; operational commands then apply the RNGMA rejection above. `RNGMA_E2E_PLATFORM=android|ios` is the unified slot target: the packager requires it to choose the platform offset, shared WDIO requires it for slot ports (Appium preflight supplies its own target), and every slot-aware platform-specific command rejects a conflicting value instead of ignoring or overriding it. When a slot is selected, computed ports win: `RNGMA_METRO_PORT` or `RNGMA_APPIUM_PORT` may be omitted or equal the computed value, but a different explicit value is rejected. A conflicting `RNGMA_ANDROID_UDID` or `RNGMA_IOS_DEVICE` is also rejected. `RNGMA_IOS_UDID` and `RNGMA_IOS_VERSION` may further constrain the exact slot-named simulator selected by the iOS selector. With no slot, the platform variable does not change serial resources.

**Create-only provisioning.** Before first use of a missing slot device, run exactly one of:

```bash
RNGMA_E2E_SLOT=<1|2|4-7> yarn tests:appium:provision <android|ios|both>
```

The command reuses an available exact existing name and otherwise creates it. It never deletes, erases, renames, or overwrites any device. Android installs the missing API 36 `google_apis` x86_64 system image if needed and creates `TestingAVD-N`; iOS creates an exact iPhone 17 on the newest available installed iOS runtime. Provisioning requires a slot and rejects `0` and `3`. A single-platform argument must match `RNGMA_E2E_PLATFORM` when that variable is set; `both` requires it unset. Those rejections happen before inventory or create. Appium and `ios:select-and-boot` remain select-and-boot only: they never create a device. A missing exact device is a blocker until this provisioning command succeeds.

**Canonical slot 1 Android sequence** (one shell per long-lived owner is normal):

```bash
RNGMA_E2E_SLOT=1 RNGMA_E2E_PLATFORM=android yarn tests:packager
RNGMA_E2E_SLOT=1 RNGMA_E2E_PLATFORM=android yarn tests:android:build
RNGMA_E2E_SLOT=1 RNGMA_E2E_PLATFORM=android yarn tests:appium:android
```

These use Metro `13007`, Appium `13013`, AVD `TestingAVD-1`, and `emulator-5558`. The packager owner keeps Metro alive; the build owner runs codegen and Gradle; the Appium owner selects or boots only the exact existing AVD, owns the Appium listener, verifies connectivity, and runs WDIO. Slot-mode Android Appium preflight may read global `adb devices` inventory, but it computes the expected slot serial first; every device-targeted `adb -s` query or action is scoped only to that serial. A missing exact serial boots the exact AVD without probing other devices. Serial mode still selects among connected devices by API. `tests:android:build` passes the real Gradle property `-PreactNativeDevServerPort=13007`, then copies the resulting APK to `RNGoogleMobileAdsExample/android/app/build/outputs/apk/debug/slots/slot-1/app-debug.apk`; Appium selects that slot path. With no slot, Gradle and `RNGoogleMobileAdsExample/android/app/build/outputs/apk/debug/app-debug.apk` remain unchanged. Named `tests:android:run` in slot mode does **not** use the React Native CLI: it validates or boots that exact AVD+serial, then serial-scopes assemble, reverse, install, and launch so no other emulator is touched. Serial mode still uses the existing RN CLI path.

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

Use a fresh writable env file because selection appends. The packager owner keeps Metro `13107` alive; the selector owner selects and boots only `RN E2E iOS slot-1` and emits its UDID/runtime; slot `tests:ios:run --udid` requires those selector variables, verifies the exact slot name and runtime, and rejects an arbitrary or serial UDID **before** build or install; the named pod/build/run path then installs on that UDID and passes `RCT_METRO_PORT=13107` as an explicit Xcode build setting; WDA is rebuilt in the shared `tooling/appium/.wda-derived`; and the Appium owner uses listener `13113`, the same selection, app, and prebuilt WDA. XCUITest launches the app with `-RCT_jsLocation localhost:13107` and `RCT_METRO_PORT=13107`, so native launch and build target the same slot Metro. Slot ownership is per nonreserved slot: the manual sequence supports one Android or iOS session in each of slots `1`, `2`, and `4`–`7`; the parallel owner below uses exactly slots `1`, `2`, and `4`. Serial operation remains one e2e at a time on `8081`/`4725`.

<a id="parallel-appium"></a>

### Parallel Appium (local only)

The complete public command surface is exactly:

```bash
yarn tests:appium:android:parallel
yarn tests:appium:ios:parallel
```

Do not set the internal spec-filter or parent/child environment variables and do not invoke the workspace implementation directly. Each command starts three isolated Appium/WDIO processes, each with `maxInstances: 1` and one fixed smoke spec: `a-primary` uses slot `1` for 15 tests, `b-secondary` uses slot `2` for 6, and `c-tertiary` uses slot `4` for 4. The aggregate is **15 + 6 + 4 = 25 tests**, not 75. Slot `3` is never selected. Existing serial commands and the manual per-slot sequence above are unchanged.

Before first device use, the exact devices for all three slots must already exist. Provision missing devices with the create-only command, once per slot:

```bash
RNGMA_E2E_SLOT=1 yarn tests:appium:provision android
RNGMA_E2E_SLOT=2 yarn tests:appium:provision android
RNGMA_E2E_SLOT=4 yarn tests:appium:provision android
RNGMA_E2E_SLOT=1 yarn tests:appium:provision ios
RNGMA_E2E_SLOT=2 yarn tests:appium:provision ios
RNGMA_E2E_SLOT=4 yarn tests:appium:provision ios
```

Run only the three commands for the platform being prepared. They create or reuse exact `TestingAVD-1`, `TestingAVD-2`, and `TestingAVD-4`, or exact `RN E2E iOS slot-1`, `slot-2`, and `slot-4`; they never delete, erase, rename, or overwrite devices. The parallel command remains select-and-boot only and fails when an exact device is missing. Before taking the slots, apply the ownership-transfer rule in [pre-flight](#pre-flight). The task must own all three slots and every required listener must be free before the orchestrator mutates codegen, files, builds, simulators, or child processes.

Android resources are:

- slot `1`: Metro `13007`, Appium `13013`, UiAutomator2 `systemPort` `13014`, MJPEG `13015`, `TestingAVD-1` / `emulator-5558`;
- slot `2`: Metro `14007`, Appium `14013`, UiAutomator2 `systemPort` `14014`, MJPEG `14015`, `TestingAVD-2` / `emulator-5560`;
- slot `4`: Metro `16007`, Appium `16013`, UiAutomator2 `systemPort` `16014`, MJPEG `16015`, `TestingAVD-4` / `emulator-5564`.

iOS resources are:

- slot `1`: Metro `13107`, Appium `13113`, XCUITest `wdaLocalPort` `13114`, MJPEG `13115`, `RN E2E iOS slot-1`;
- slot `2`: Metro `14107`, Appium `14113`, XCUITest `wdaLocalPort` `14114`, MJPEG `14115`, `RN E2E iOS slot-2`;
- slot `4`: Metro `16107`, Appium `16113`, XCUITest `wdaLocalPort` `16114`, MJPEG `16115`, `RN E2E iOS slot-4`.

The Android command checks all twelve ports first, runs Codegen once, then serializes slot `1`, `2`, and `4` APK builds so each build bakes its own Metro port and preserves a distinct `.../debug/slots/slot-N/app-debug.apk`. Only after every build succeeds does it start three task-owned Metro children, wait for all three listeners, and start the three Appium/WDIO children concurrently. Serializing Gradle output avoids build races.

The iOS command has the same twelve-port precheck and one Codegen. It requires the frozen root Ruby bundle to be installed first (`BUNDLE_FROZEN=true bundle install`). It serially selects/boots slots `1`, `2`, and `4` into fresh per-slot environment files, requires all three exact simulators to resolve to the same installed iOS runtime, then serially builds/installs each app. Each build is copied to `RNGoogleMobileAdsExample/ios/build/slots/slot-N/ReactTestApp.app`. After all builds, one shared WDA prebuild runs against the first selection; the common runtime plus serialized build/WDA preparation avoids DerivedData and WDA build races. The command then starts the three Metros and three Appium/WDIO children concurrently, with each Appium child consuming its slot-specific app and simulator selection.

Each Appium/collector stream is preserved separately at `/tmp/rngma-e2e-<platform>-slot-<N>-<label>.log`; each Metro has the matching `.packager.log`. Logs are replaced for a new invocation, so copy them before rerunning if they are needed. Abort handling is armed before any planning, preparation, or mutation; every spawn and await checks it, task-owned children are cancelled once, and the run never continues after abort. The parent waits up to 120 seconds for each task-owned Metro and fails immediately if a packager exits before readiness. Port, preparation, Metro-readiness, Appium, or unexpected packager failure stops started task-owned children and exits nonzero. A successful run prints all three passing rows and total `25`, then stops its packagers. Every printed or returned per-slot summary includes `slot`, `spec`, `tests`, `status`, numeric `exitCode`, and `log`. `exitCode` is `0` on pass, the child's numeric code when it exited without a signal, `130` for any child signal (not `128+n`) and for cancelled siblings, and `1` when that slot's packager spawn/readiness or other startup rejection has no child code; the parent process exit remains separate from those per-slot codes. It does not perform global device or simulator cleanup and does not stop unrelated listeners.

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

When those named scripts are the e2e gate, `tee` `yarn tests:appium:android` to a unique `/tmp/rngma-e2e-android-*.log` and `yarn tests:appium:ios` to a unique `/tmp/rngma-e2e-ios-*.log`. Redirect/`tee` of the **same** named yarn script is allowed; do not add other wrappers.

Device driver: Appium 3 + WebdriverIO in `tooling/appium/` ([§ Appium](#appium-scaffold)). Specs: `tooling/appium/test/specs/**/*.ts`. App: `RNGoogleMobileAdsExample/` (format gallery + stable `testID`s). Serial operation is one e2e at a time on `:8081`; manual slot operation is one session per supported nonreserved slot, while the local parallel owner fixes three one-worker sessions to slots `1`, `2`, and `4` ([§ parallel Appium](#parallel-appium)). No source edits during a run.

There is no separate macOS-app e2e target. iOS e2e is `yarn tests:ios:pod:install` / `yarn tests:ios:run` (install) then `yarn tests:appium:ios` (local Mac or CI `macos-15`; the required WDA prebuild comes first: [§ prebuilt WDA](#ios-wda-prebuilt-validation)).

GitHub Actions fails when the app install or Appium suite fails; artifact uploads remain unconditional. Local gates still require counts + `/tmp/rngma-e2e-*.log`, or triaged `simulator_log` / `adb_logs`.

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

**Android app path:** default `RNGoogleMobileAdsExample/android/app/build/outputs/apk/debug/app-debug.apk` after `yarn tests:android:build` (override `RNGMA_ANDROID_APK`). With a slot, the same named build passes the computed Metro port as Gradle's real `reactNativeDevServerPort`, then copies the APK to `RNGoogleMobileAdsExample/android/app/build/outputs/apk/debug/slots/slot-N/app-debug.apk`; Appium selects that slot path unless `RNGMA_ANDROID_APK` explicitly overrides it. Appium install/reset may clear app data; the named Android Appium command restores React Native `debug_http_host=127.0.0.1:<computed-Metro-port>` after that reset and launches afterward. Do not invent ad hoc `adb` / SharedPreferences / launch steps. Metro reverse and connectivity use the same computed port for the selected serial ([pre-flight](#pre-flight)). **iOS:** `yarn tests:ios:run --udid <selected-udid>` runs codegen, the exact frozen bundled pod script, and `react-native build-ios --buildFolder build`, then installs and launches `RNGoogleMobileAdsExample/ios/build/Build/Products/Debug-iphonesimulator/ReactTestApp.app` on that simulator with `simctl`; Appium uses the same exact path. Slot mode also requires selector-produced `RNGMA_IOS_UDID` / `RNGMA_IOS_VERSION`, matches `--udid` to that UDID, and verifies the exact slot simulator name and runtime before those steps. Slot builds add explicit Xcode setting `RCT_METRO_PORT=<computed-iOS-Metro-port>`, and XCUITest supplies `-RCT_jsLocation localhost:<same-port>` plus that environment value at launch. Serial builds and launches add neither, preserving prior behavior. Set `RNGMA_IOS_APP` only to explicitly override Appium. Never discover an app from DerivedData or fall back to an installed bundle id.

<a id="request-outcome-sample"></a>

## Request-outcome sample

Cumulative aggregate from the [request-outcome contracts](#appium-scaffold) above. It is durable because these counts are the input that selected the [settled acceptance rule](#representative-acceptance) each format now holds — see [documentation policy § cumulative verification-evidence tables](../documentation-policy.md#verification-evidence-tables) for why counts live here and why logs, run identifiers, and dates do not.

**Lower bound, not a census.** Every cell counts only attempts whose classification is verified and non-overlapping across sessions, so totals only ever grow. Absence of a count is not evidence that an outcome cannot occur. Every subsequent qualifying run feeds this sample. The published table is the snapshot at the last implementation or documentation pass before independent review; runs taken while that tree is frozen accumulate for the next permitted documentation pass and do not mutate the table under review. The four request-outcome contracts live only in `formats.smoke.a-primary`; parallel slots `2` and `4` run `b-secondary` / `c-tertiary` and do not run them ([§ parallel Appium](#parallel-appium)).

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

Before Android Appium, inventory AVDs with `emulator -list-avds`. Serial mode preflights connected devices, deterministically prefers API 36, passes its selected serial to WDIO, and verifies that serial's computed Metro reverse **and** that the device can connect through it to this checkout's Metro. Slot-mode Android isolation (expected serial first; every `adb -s` query/action only on that serial; missing exact serial boots the exact AVD without probing others): [§ e2e slots](#e2e-slots). Do not invent a separate `adb reverse`. Missing exact slot device: use the create-only [provisioning command](#e2e-slots); Appium never creates it. Session launch after Appium install/reset: [§ Android app path](#android-app-path). CI Android e2e remains serial on `TestingAVD`, `8081`, and `4725`, using API 36 `google_apis` x86_64 (Play services, no Play Store login). UiAutomator2 requires Android 8+ (API 26): boot the reported qualifying AVD and retry the same command, never retry API 24. Before iOS Appium, preflight inventories `xcrun simctl list devices available`, selects an **existing exact name** by UDID (`iPhone 17` serially or `RN E2E iOS slot-N` for a slot), and passes that UDID to every WDIO session. It prefers an already booted exact match, then the newest available runtime; `RNGMA_IOS_VERSION` constrains the runtime without a checked-in version pin, and an explicit `RNGMA_IOS_UDID` must resolve to an available exact-name match. The named selector opens each iOS device pass, because the required WDA prebuild consumes its variables: it boots that exact simulator and records `RNGMA_IOS_UDID` / `RNGMA_IOS_VERSION` into its required `--github-env` file (CI passes `$GITHUB_ENV`), which `tests:ios:run --udid`, simulator logging, WDA prebuild, and Appium then consume — local file path, consumption, and sequence: [§ prebuilt WDA](#ios-wda-prebuilt-validation). No exact match is an immediate blocker—use the create-only provisioning command for a slot; Appium and the selector never fabricate a simulator. The exact default or `RNGMA_IOS_APP`-configured `ReactTestApp.app` is usable only when its inner `ReactTestApp` executable is a regular file. A missing or incomplete exact app fails preflight: rebuild or correct the override rather than discovering another build or falling back to an installed app.

Before taking any e2e slot required by this task, determine whether another task owns it. If the slot is occupied and this task has no explicit ownership transfer, ask the user whether this task may take it. Without authorization, do not stop or otherwise displace the owner. Once ownership is transferred, take the slot and continue.

Serial ports `:8081` and `:4725`, or the selected slot's computed Metro/Appium ports, are e2e resources, not the ownership rule itself. Metro must be **this** checkout (`RNGoogleMobileAdsExample/`), and its selected port must be free before `yarn tests:packager:reset-cache`. The canonical Appium command fails preflight if its selected listener port is occupied; identify the listener and stop it only when this task owns it. Never launch WDIO into an occupied Appium port. The TCP probe is an early guard that closes before Appium spawns, so a race remains; Appium startup output is authoritative and must still be watched for `EADDRINUSE`. Revert `.only` before area-focused/full.

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
