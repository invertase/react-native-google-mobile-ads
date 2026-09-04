---
okf_version: '0.1'
---

# React Native Google Mobile Ads knowledge bundle

- [Documentation/commit policy](documentation-policy.md#durable-vs-ephemeral) — three kinds (session scratch ephemeral under `.agents/`; gate state in internal tracker per policy; do not add ephemeral files here); [commits as documentation](documentation-policy.md#commits-as-documentation); [Efficiency](documentation-policy.md#efficiency); [OKF update contract](documentation-policy.md#okf-update-contract); [pull requests](documentation-policy.md#pull-requests)
- [Documentation site maintenance](documentation-site-maintenance.md) — docs.page [`docs.json`](documentation-site-maintenance.md#docsjson) + `docs/`
- [Architecture decisions](architecture-decisions.md) — `GMA-AD-*` (what + why); [GMA-AD-1](architecture-decisions.md#gma-ad-1); [GMA-AD-2](architecture-decisions.md#gma-ad-2)
- [CI workflows](ci-workflows/index.md) — [§ workflows](ci-workflows/index.md#workflows); [publish Podfile.lock](ci-workflows/index.md#publish-podfile-lock); [e2e continue-on-error](ci-workflows/index.md#e2e-continue-on-error); [§ triage](ci-workflows/index.md#triage)
- [Testing](testing/index.md) — all testing files; [platform coverage](testing/running-e2e.md#platform-coverage-gate-blocking), [Expo plugin](testing/validation-checklist.md#expo-plugin), [coverage evidence](testing/coverage-design.md#coverage-evidence-package), [native agent collection](testing/coverage-design.md#native-agent-collection)
