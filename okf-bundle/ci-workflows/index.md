# CI workflows

GitHub Actions job shape and artifact triage for **this** repo. Commands: [agent command policy](../testing/agent-command-policy.md). E2e: [running e2e](../testing/running-e2e.md).

Do not copy other repos’ Detox patch inventories, macOS e2e, Jacoco merge, or emulator-cloud quota notes.

## Workflows

| Workflow | File | Local equivalent | Artifacts / notes |
|----------|------|------------------|-------------------|
| Jest | [`.github/workflows/tests_jest.yml`](../../.github/workflows/tests_jest.yml) | `yarn tests:jest-coverage` | Codecov upload |
| E2e Android | [`.github/workflows/tests_e2e_android.yml`](../../.github/workflows/tests_e2e_android.yml) | `yarn tests:android:build` then `yarn tests:android:run` | `adb_logs` (`adb-log.txt`); Codecov; Metro prefetch on `:8081` |
| E2e iOS | [`.github/workflows/tests_e2e_ios.yml`](../../.github/workflows/tests_e2e_ios.yml) | `yarn tests:ios:pod:install` then `yarn tests:ios:run` | `simulator_log`; Codecov; Metro prefetch on `:8081` |
| Lint | [`.github/workflows/linting.yml`](../../.github/workflows/linting.yml) | `yarn lint:code`; `yarn tsc:compile` | `eslint-report.json` |
| Docs | [`.github/workflows/docs.yml`](../../.github/workflows/docs.yml) | `yarn lint:spellcheck` | — |
| PR title | [`.github/workflows/pr_title.yml`](../../.github/workflows/pr_title.yml) | [documentation-policy § pull requests](../documentation-policy.md#pull-requests) | Conventional Commits; `validateSingleCommit` |

E2e and Jest workflows `paths-ignore` markdown/docs. Lint and docs workflows still run on those diffs.

## Triage

- iOS e2e failure: download `simulator_log`, then local `/tmp/rngma-e2e-ios.log`.
- Android e2e failure: download `adb_logs`, then local `/tmp/rngma-e2e-android.log`.
- Packager never healthy: Metro must be **this** checkout on `:8081` — [running e2e § pre-flight](../testing/running-e2e.md#pre-flight).
- Grow platform pages here only after a failure mode is verified on **this** repo.
