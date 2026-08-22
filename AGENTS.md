# React Native Google Mobile Ads — agents

`src/` → `lib/` via `yarn prepare`. Native `android/` `ios/`. Expo `plugin/`. Example `RNGoogleMobileAdsExample/`. E2e `e2e/`. Docs `docs/`. Contributor/review norms: `CONTRIBUTING.md`.

Root `yarn`. Shell: [agent-command-policy](okf-bundle/testing/agent-command-policy.md) only. E2e: [running-e2e § agent rule](okf-bundle/testing/running-e2e.md#agent-rule-read-first). Loop: [change-authoring](okf-bundle/testing/change-authoring-workflow.md) — [validation evidence package](okf-bundle/testing/validation-checklist.md#validation-evidence-package) and [coverage evidence](okf-bundle/testing/coverage-design.md#coverage-evidence-package) before gates close or push. Index: [okf-bundle](okf-bundle/index.md). Testing: [testing/index.md](okf-bundle/testing/index.md). Match work type and validation tier: [iteration vocabulary](okf-bundle/testing/iteration-vocabulary.md).

Follow [documentation-policy § public vs ephemeral vs private](okf-bundle/documentation-policy.md#durable-vs-ephemeral): GitHub-public **reference** docs, this file, commits, and PR titles must not contain ephemeral **fields** or private items. Work-queue **files** may hold ephemeral fields (default: `.agents/work-queues/`, gitignored; do not stage or commit). This repo does not commit queues under `okf-bundle/`; do not add them. Private items stay off GitHub, including off any queue file.

## PR instructions

- Scoped PRs. API/behavior change → tests + docs + types in the same PR.
- PR titles: [documentation-policy § pull requests](okf-bundle/documentation-policy.md#pull-requests) (single-commit title equals that commit's subject; multi-commit PRs use a summary title). Examples: `CONTRIBUTING.md`.
