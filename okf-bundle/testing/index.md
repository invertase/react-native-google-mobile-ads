# Testing

* [Agent command policy](agent-command-policy.md) — shell allowlist (read first); [§ prepare must finish first](agent-command-policy.md#prepare-must-finish-first)
* [Documentation/commit policy](../documentation-policy.md) — [public vs ephemeral vs private](../documentation-policy.md#durable-vs-ephemeral), [pull requests](../documentation-policy.md#pull-requests), [OKF update contract](../documentation-policy.md#okf-update-contract), [Efficiency](../documentation-policy.md#efficiency)
* [Change authoring](change-authoring-workflow.md) — loop, [§ gates](change-authoring-workflow.md#gates), [§ frozen tree](change-authoring-workflow.md#frozen-tree), [§ quality standards](change-authoring-workflow.md#quality-standards), [§ validation evidence](validation-checklist.md#validation-evidence-package), [§ commit](change-authoring-workflow.md#commit)
* [Iteration vocabulary](iteration-vocabulary.md) — work types, tiers, queue fields
* [Running e2e](running-e2e.md) — canonical `yarn tests:*` only; [§ agent rule](running-e2e.md#agent-rule-read-first); [§ platform coverage gate](running-e2e.md#platform-coverage-gate-blocking); [§ pre-flight](running-e2e.md#pre-flight); [§ diagnosis](running-e2e.md#e2e-diagnosis)
* [Validation checklist](validation-checklist.md) — handoff command sequence; [§ lint](validation-checklist.md#lint-and-formatting); [§ Expo plugin](validation-checklist.md#expo-plugin); [§ OKF bundle review](validation-checklist.md#okf-bundle-review); [§ validation evidence package](validation-checklist.md#validation-evidence-package)
* [Coverage design](coverage-design.md) — touched-line bar; [§ evidence package](coverage-design.md#coverage-evidence-package)
* [Architecture decisions](../architecture-decisions.md) — `GMA-AD-*`; [GMA-AD-1 plugin path](../architecture-decisions.md#gma-ad-1)
* [CI workflows](../ci-workflows/index.md) — Actions jobs, `simulator_log` / `adb_logs`
