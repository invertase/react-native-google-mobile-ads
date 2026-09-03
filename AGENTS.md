# React Native Google Mobile Ads — agents

`src/` → `lib/` via `yarn prepare`. Native `android/` `ios/`. Expo `plugin/`. Example `RNGoogleMobileAdsExample/`. E2e `e2e/`. Docs `docs/`. Contributor/review norms: `CONTRIBUTING.md`.

Root `yarn`. Shell: [agent-command-policy](okf-bundle/testing/agent-command-policy.md) only. E2e: [running-e2e § agent rule](okf-bundle/testing/running-e2e.md#agent-rule-read-first) and [platform coverage](okf-bundle/testing/running-e2e.md#platform-coverage-gate-blocking). A green e2e workflow is **not** a pass ([continue-on-error](okf-bundle/ci-workflows/index.md#e2e-continue-on-error)); use local counts + `/tmp/rngma-e2e-*.log`. Loop: [change-authoring](okf-bundle/testing/change-authoring-workflow.md#loop) (`documentation?` then frozen [OKF scan](okf-bundle/testing/validation-checklist.md#okf-bundle-review) when `okf-bundle/`, `AGENTS.md`, or `CONTRIBUTING.md` changed; freeze: [§ frozen tree](okf-bundle/testing/change-authoring-workflow.md#frozen-tree)). Before commit or push: [validation evidence package](okf-bundle/testing/validation-checklist.md#validation-evidence-package). [Coverage evidence](okf-bundle/testing/coverage-design.md#coverage-evidence-package) only when `src/` **or** `android/` **or** `ios/` **or** `plugin/` TS is in the diff; `app.plugin.js`-only is `n/a` unless `plugin/` TS changed ([§ gates](okf-bundle/testing/change-authoring-workflow.md#gates)). Index: [okf-bundle](okf-bundle/index.md). Testing: [testing/index.md](okf-bundle/testing/index.md). Match work type and validation tier: [iteration vocabulary](okf-bundle/testing/iteration-vocabulary.md).

Follow [documentation-policy § public vs ephemeral vs private](okf-bundle/documentation-policy.md#durable-vs-ephemeral) for ephemeral `.agents/` content and the tracked `.agents/.gitignore` infrastructure exception. Do not add ephemeral files under `okf-bundle/`.

## PR instructions

- Scoped PRs. API/behavior change → tests + docs + types in the same PR.
- PR titles: [documentation-policy § pull requests](okf-bundle/documentation-policy.md#pull-requests) (single-commit title equals that commit's subject; multi-commit PRs use a summary title). Examples: `CONTRIBUTING.md`.
