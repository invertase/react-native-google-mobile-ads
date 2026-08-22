---
type: Reference
title: Validation checklist
description: Handoff command sequence.
tags: [testing, validation, jest, lint]
timestamp: 2026-08-19T00:00:00Z
---

# Validation checklist

Coverage: [coverage design](coverage-design.md). Tiers: [change authoring](change-authoring-workflow.md). Commands listed here are the sequence; allowlist: [agent command policy](agent-command-policy.md).

| Work type | Run |
|-----------|-----|
| `gap-analysis` | Read APIs/docs |
| `baseline-capture` | Jest + e2e, [platforms](running-e2e.md#platform-coverage-gate-blocking), no `.only` |
| `implementation` | Jest; e2e if native/plugin; `.only` local OK |
| `independent-review` | Full checklist, frozen, no `.only` |
| `pre-merge-validation` | CI-equivalent, **full** |

```bash
yarn && yarn prepare && yarn tsc:compile
yarn tests:jest                    # or tests:jest-coverage (CI)
yarn lint:js
yarn lint:android                  # android/**/*.java
yarn lint:ios:check                # ios/**/*.{h,cpp,m,mm}
yarn lint:code                     # CI lint
yarn lint                          # lint:code + tsc
yarn lint:markdown:check && yarn lint:spellcheck   # docs/**
```

<a id="lint-and-formatting"></a>

## Lint and formatting

**Blocking before `implementation` handoff and on the frozen tree for `independent-review`.** Run the lint rows in the sequence above (`yarn lint:js`, `yarn lint:android`, `yarn lint:ios:check`, `yarn lint:code` / `yarn lint`). Docs: `yarn lint:markdown:check` and `yarn lint:spellcheck` when `docs/**`. Allowlist: [agent command policy](agent-command-policy.md). User-docs sidebar: [documentation site maintenance](../documentation-site-maintenance.md).

<a id="expo-plugin"></a>

## Expo plugin

**Blocking when the diff touches `plugin/` or `app.plugin.js`.** [GMA-AD-1](../architecture-decisions.md#gma-ad-1): `yarn prepare` (includes `build:plugin`) then `yarn tests:jest plugin/__tests__/`. Do not invent attw or a second test runner.

E2e: [running e2e](running-e2e.md).

<a id="okf-bundle-review"></a>

## OKF bundle review

Before handoff, run the [OKF update contract](../documentation-policy.md#okf-update-contract) in a **fresh context**:

1. Promote durable learnings into the owning `okf-bundle/` doc.
2. Check `okf-bundle/testing/` for conflicts with verified behavior; fix drift.
3. Independent scan of the **entire** `okf-bundle/` tree. Give the scanner a short summary of what changed and which files were touched. Confirm every contract row: Canonical location, DRY, [Efficiency](../documentation-policy.md#efficiency), link hygiene, Durability. Fix violations before handoff/merge.

Goal: each iteration improves OKF and removes conflicting guidance. The contract owns check meanings; this section is the handoff entry — do not skip the hop by treating this list as a thinner substitute.

<a id="validation-evidence-package"></a>

## Validation evidence package

**Blocking.** Record this table before closing gates or publishing. History rewrite invalidates it.

| Step | Command | Exit | Evidence |
|------|---------|------|----------|
| prepare | `yarn prepare` | 0 | — |
| tsc | `yarn tsc:compile` | 0 | — |
| jest | `yarn tests:jest <paths>` | 0 | N/N |
| e2e iOS / Android | `yarn tests:ios:run` / `tests:android:run` | 0 | counts + `/tmp/rngma-e2e-*.log` |
| lint | `yarn lint:code` | 0 | — |
| docs | `yarn lint:spellcheck` | 0 | if `docs/**` |
| plugin | `yarn tests:jest plugin/__tests__/` | 0 | if `plugin/` — [§ Expo plugin](#expo-plugin) |
| coverage | `yarn tests:jest-coverage` | — | [evidence package](coverage-design.md#coverage-evidence-package) |
