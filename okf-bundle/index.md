---
okf_version: '0.1'
---

# React Native Google Mobile Ads knowledge bundle

- [Documentation/commit policy](documentation-policy.md#durable-vs-ephemeral) — three kinds (session scratch ephemeral under `.agents/`; gate state in internal tracker per policy; do not add ephemeral files here; narrow [cumulative verification-evidence table](documentation-policy.md#verification-evidence-tables) exception); [commits as documentation](documentation-policy.md#commits-as-documentation); [Efficiency](documentation-policy.md#efficiency); [OKF update contract](documentation-policy.md#okf-update-contract); [pull requests](documentation-policy.md#pull-requests)
- [Documentation site maintenance](documentation-site-maintenance.md) — docs.page [`docs.json`](documentation-site-maintenance.md#docsjson) + `docs/`; [generated TypeDoc API reference](documentation-site-maintenance.md#api-reference); [agent steering surfaces](documentation-site-maintenance.md#agent-steering-surfaces) (`packages/core/AGENTS.md`, `llms.txt`, README agent section)
- [Architecture decisions](architecture-decisions.md) — `GMA-AD-*` (what + why); [GMA-AD-1](architecture-decisions.md#gma-ad-1); [GMA-AD-2](architecture-decisions.md#gma-ad-2); [GMA-AD-3](architecture-decisions.md#gma-ad-3); [GMA-AD-4](architecture-decisions.md#gma-ad-4); [GMA-AD-5](architecture-decisions.md#gma-ad-5) (dual Android classic / Next-Gen backends)
- [CI workflows](ci-workflows/index.md) — [§ workflows](ci-workflows/index.md#workflows); [publish convergence](ci-workflows/index.md#publish-podfile-lock); [truthful e2e checks](ci-workflows/index.md#e2e-continue-on-error); [§ triage](ci-workflows/index.md#triage)
- [Testing](testing/index.md) — all testing files; [platform coverage](testing/running-e2e.md#platform-coverage-gate-blocking), [Expo plugin](testing/validation-checklist.md#expo-plugin), [coverage evidence](testing/coverage-design.md#coverage-evidence-package), [native agent collection](testing/coverage-design.md#native-agent-collection)
