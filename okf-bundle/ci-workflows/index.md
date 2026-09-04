# CI workflows

GitHub Actions job shape and artifact triage for **this** repo. Commands: [agent command policy](../testing/agent-command-policy.md). E2e names: [local e2e](../testing/running-e2e.md#local-e2e-commands). Which e2e to run: [platform coverage](../testing/running-e2e.md#platform-coverage-gate-blocking).

Do not copy other repos’ Detox patch inventories, macOS-app e2e suites, Jacoco merge, or emulator-cloud quota notes.

<a id="workflows"></a>

## Workflows

| Workflow | File | Local equivalent | Artifacts / notes |
|----------|------|------------------|-------------------|
| Jest | [`.github/workflows/tests_jest.yml`](../../.github/workflows/tests_jest.yml) | `yarn tests:jest-coverage` | Codecov upload |
| E2e Android | [`.github/workflows/tests_e2e_android.yml`](../../.github/workflows/tests_e2e_android.yml) | [platform coverage](../testing/running-e2e.md#platform-coverage-gate-blocking) + [named scripts](../testing/running-e2e.md#local-e2e-commands) (`yarn tests:appium:android`) | `adb_logs`; Codecov; Metro prefetch on `:8081`. **Run Emulator Tests**: [continue-on-error](#e2e-continue-on-error) |
| E2e iOS | [`.github/workflows/tests_e2e_ios.yml`](../../.github/workflows/tests_e2e_ios.yml) | [platform coverage](../testing/running-e2e.md#platform-coverage-gate-blocking) + [named scripts](../testing/running-e2e.md#local-e2e-commands) (`yarn tests:appium:ios`) | `simulator_log`; Codecov; Metro prefetch on `:8081`. **Install example on simulator**, **Build and Run Appium e2e**, and **Create Simulator Log**: [continue-on-error](#e2e-continue-on-error) |
| Lint | [`.github/workflows/linting.yml`](../../.github/workflows/linting.yml) | [lint-by-tree](../testing/validation-checklist.md#lint-and-formatting) | CI always runs `yarn lint:code` and repo-root `./gradlew ktlintCheck`; local agents do not copy the `yarn lint:code` combo unless `packages/core/src/` **and** `packages/core/android/` **and** `packages/core/ios/` changed. Also `yarn tsc:compile`. `eslint-report.json` |
| Docs | [`.github/workflows/docs.yml`](../../.github/workflows/docs.yml) | `yarn lint:spellcheck` | Job title mentions Markdown; CI is spellcheck only — [§ lint](../testing/validation-checklist.md#lint-and-formatting) |
| PR title | [`.github/workflows/pr_title.yml`](../../.github/workflows/pr_title.yml) | [documentation-policy § pull requests](../documentation-policy.md#pull-requests) | Conventional Commits; `validateSingleCommit` |
| Test patches | [`.github/workflows/create_test_patches.yml`](../../.github/workflows/create_test_patches.yml) | Do not invent a local substitute | `workflow_dispatch` + push/PR; patch-package artifacts |
| Publish | [`.github/workflows/publish.yml`](../../.github/workflows/publish.yml) | Maintainers only | `workflow_dispatch` only (`on.push` exists; job `if` ignores push). Runs on **macos-15** with Xcode + CocoaPods so semantic-release prepare can refresh `RNGoogleMobileAdsExample/ios/Podfile.lock` into the release commit ([§ publish Podfile.lock](#publish-podfile-lock)). |
| Stale | [`.github/workflows/stale.yml`](../../.github/workflows/stale.yml) | n/a | Scheduled issue/PR stale bot |

Jest/e2e/patch workflows `paths-ignore` markdown and `docs/**` (YAML also lists `website/**`; that tree is not in this repo — ignore it). Lint runs on markdown PRs and pushes to `main`. Docs spellcheck is PR-only.

<a id="publish-podfile-lock"></a>

## Publish Podfile.lock refresh

After `@semantic-release/npm` bumps `packages/core/package.json`, the local prepare plugin `scripts/semantic-release-refresh-ios-pod-lockfile.js` runs `yarn release:refresh-ios-pod-lockfile` (Darwin-only): two `yarn tests:ios:pod:install` passes, asserts `RNGoogleMobileAds` / `Google-Mobile-Ads-SDK` / `GoogleUserMessagingPlatform` match `packages/core` version + `sdkVersions.ios`, then requires an idempotent `git diff --exit-code` on `RNGoogleMobileAdsExample/ios/Podfile.lock`. `@semantic-release/git` includes that lockfile in the release commit assets.

Do **not** delete `Podfile.lock` on routine `yarn tests:ios:pod:install` — install updates it in place. Pin-vs-lock drift (for example declared GMA `13.5.0` vs a stale lock) is fixed by that install or by the release refresh, not by wiping the lockfile. Local smoke without CocoaPods churn: `node ./scripts/refresh-ios-pod-lockfile.js --assert-pins-only` or `--self-check`. Commands: [agent command policy](../testing/agent-command-policy.md#canonical-registry).

<a id="e2e-continue-on-error"></a>

## E2e continue-on-error

`continue-on-error: true` is on Android **Run Emulator Tests** (Appium) and on iOS **Install example on simulator** plus **Build and Run Appium e2e**. iOS **Create Simulator Log** also sets it; that step is log capture, not the e2e pass signal. A green workflow is **not** an e2e pass. Pass signal: local counts + unique `/tmp/rngma-e2e-*-*.log` tees ([running e2e § local commands](../testing/running-e2e.md#local-e2e-commands)), or triaged `simulator_log` / `adb_logs`. Soft-fail Appium CI is intentional until the flake budget closes.

<a id="triage"></a>

## Triage

- iOS e2e failure: download `simulator_log`, then the local unique `/tmp/rngma-e2e-ios-*.log` from [running e2e](../testing/running-e2e.md#local-e2e-commands).
- Android e2e failure: download `adb_logs`, then the local unique `/tmp/rngma-e2e-android-*.log` from [running e2e](../testing/running-e2e.md#local-e2e-commands).
- Packager never healthy: Metro must be **this** checkout on `:8081` — [running e2e § pre-flight](../testing/running-e2e.md#pre-flight).
- Grow platform pages here only after a failure mode is verified on **this** repo.
