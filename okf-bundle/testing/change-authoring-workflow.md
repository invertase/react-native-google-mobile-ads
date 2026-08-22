---
type: Reference
title: Change authoring workflow
description: Verified product-change loop, gates, frozen tree, quality bar.
tags: [testing, validation, workflow]
timestamp: 2026-08-19T00:00:00Z
---

# Change authoring workflow

How to author a product change. Queues hold gate state; they do not restate this loop.

**Policy:** [documentation policy](../documentation-policy.md). **Terms:** [iteration vocabulary](iteration-vocabulary.md). **Commands:** [validation checklist](validation-checklist.md), [agent command policy](agent-command-policy.md).

**Product trees:** `src/`, `android/`, `ios/`, `plugin/`, `e2e/`, `docs/`, `RNGoogleMobileAdsExample/` (not `node_modules`). `lib/` and `src/version.ts` from `yarn prepare`.

## Loop

`gap-analysis?` → `baseline-capture?` → `implementation` (`unit-focused`) → `independent-review` (`area-focused`, frozen) → `documentation?` → `commit` → `pre-merge-validation` (`full`) if merging.

| Work type | Tier | Edits | Commit |
|-----------|------|-------|--------|
| `gap-analysis` | none | read-only | no |
| `baseline-capture` | `area-focused` | local `.only` OK | no |
| `implementation` | `unit-focused` | yes | no |
| `independent-review` | `area-focused` | frozen — [§ frozen tree](#frozen-tree) | no |
| `documentation` | none | docs/OKF | no |
| `commit` | none | stage | yes |
| `pre-merge-validation` | `full` | revert `.only` | no |

Tiers: `unit-focused` = Jest + optional narrow e2e, `.only` local only. `area-focused` = full area, no `.only`, frozen for review. `full` = CI-equivalent.

## Gates

| Gate | Closes when |
|------|-------------|
| `implementation` | Unit-focused green; native/plugin/codegen → [platform e2e](running-e2e.md#platform-coverage-gate-blocking); [lint](validation-checklist.md#lint-and-formatting) |
| `review` | Area-focused green on frozen tree; **all** findings fixed ([§ quality](#quality-standards)) |
| `commit` | Prior gates closed with [evidence package](validation-checklist.md#validation-evidence-package) |

Open `review` = unverified.

<a id="validation-evidence-blocking"></a>

### Validation evidence

**Blocking.** Gates close only when recorded evidence shows the required validation ran and passed. Record using the [validation evidence package](validation-checklist.md#validation-evidence-package). No exit codes / log paths → gate stays open.

| Gate | Evidence |
|------|----------|
| `implementation` | prepare/tsc/jest exits; lint if `src/` native plugin; [plugin tests](validation-checklist.md#expo-plugin) if `plugin/`; e2e counts + log if native/codegen/plugin |
| `review` | Frozen re-run; [coverage evidence](coverage-design.md#coverage-evidence-package) when required |
| `commit` | Prior evidence; no `.only` staged |
| Publication | `review` closed on **those** commits; no product edits since |

Forbidden: commit/push without evidence; rewrite history without re-validation; self-accepted coverage gaps.

## Quality standards

<a id="acceptable-exceptions"></a>

### Acceptable exceptions

Only with **user confirmation**: (1) intractable platform/SDK/toolchain limit + evidence, or (2) user deferral + rationale. Testable code gets a test or is deleted.

<a id="review-findings--resolve-do-not-defer"></a>

### Review findings

Findings `critical`/`serious`/`minor`/`nit`. Review gate closes only when all are fixed or an [exception](#acceptable-exceptions) applies.

## Frozen tree

No edits to product trees or bundle-affecting OKF during `independent-review` (except revert `.only`). Separate implementation and review passes.

## Host rule

One e2e at a time. [Pre-flight](running-e2e.md#pre-flight) each run (prepare finished, Metro is this checkout). Canonical e2e only.

## Implementation

Pre-flight → edit → `yarn prepare` if `src/`/`plugin/` → Jest → e2e if native → lint. Plugin/codegen: [GMA-AD-1](../architecture-decisions.md#gma-ad-1).

Native GMA/UMP calls: read each platform’s official API; don’t copy Android fixes to iOS without checking; record citations in the queue.

`.only` or a single e2e file is allowed for `unit-focused` diagnosis only. Revert before `area-focused` / `full`. Never commit `.only`. Diagnosis steps: [running e2e § diagnosis](running-e2e.md#e2e-diagnosis).

## Commit

One focused commit when gates close. Never stage `.only`, `.agents/work-queues/`, or new work-queue files under `okf-bundle/`. Before `git commit`, set the queue row's `commit_subject` to the commit's subject line and close `commit_gate`. Do not record SHAs. After commit, the git subject and the queue `commit_subject` must match character-for-character. Single-commit PR titles: [documentation-policy § pull requests](../documentation-policy.md#pull-requests). Queue location and gitignore: [documentation policy § public vs ephemeral vs private](../documentation-policy.md#durable-vs-ephemeral).

```bash
rg '\.only\(' src/ e2e/ plugin/
```

Gate rows, `next_work_type`, and `commit_subject` live in work queues only — do not paste gate rows into this file. Staging, SHA ban, and character-match for `commit_subject` are this section. Do not commit `.agents/work-queues/`. Do not add queue files under `okf-bundle/`.
