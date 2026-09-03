---
type: Reference
title: Change authoring workflow
description: Verified product-change loop, gates, frozen tree, quality bar.
tags: [testing, validation, workflow]
timestamp: 2026-08-22T00:00:00Z
---

# Change authoring workflow

How to author a product change. Gate state is maintained outside this repo per [documentation policy](../documentation-policy.md#durable-vs-ephemeral); this doc restates only the verified product-change loop.

**Policy:** [documentation policy](../documentation-policy.md). **Terms:** [iteration vocabulary](iteration-vocabulary.md). **Commands:** [validation checklist](validation-checklist.md), [agent command policy](agent-command-policy.md).

**Product trees:** `src/`, `android/`, `ios/`, `plugin/`, `e2e/`, `docs/`, `RNGoogleMobileAdsExample/` (not `node_modules`). `lib/` and `src/version.ts` from `yarn prepare`.

<a id="loop"></a>

## Loop

`gap-analysis?` → `baseline-capture?` → `implementation` (`unit-focused`) → `documentation?` → `independent-review` (`area-focused`, frozen) → `commit` → `pre-merge-validation` (`full`) if merging.

OKF, `AGENTS.md`, and `CONTRIBUTING.md` edits belong in `documentation?` **on the same change set** as the product work they describe. `independent-review` of that frozen tree **is** the [OKF bundle scan](validation-checklist.md#okf-bundle-review) when the frozen tree includes `okf-bundle/`, `AGENTS.md`, or `CONTRIBUTING.md` (including a `CONTRIBUTING.md`-only tree). Do not add OKF after a frozen review without another `independent-review`. Close `commit` only after that scan (when OKF/`AGENTS.md`/`CONTRIBUTING.md` changed).

| Work type | Tier | Edits | Commit |
|-----------|------|-------|--------|
| `gap-analysis` | none | read-only | no |
| `baseline-capture` | `area-focused` | no `.only` | no |
| `implementation` | `unit-focused` | yes | no |
| `documentation` | none | docs/OKF/`AGENTS.md`/`CONTRIBUTING.md` | no |
| `independent-review` | `area-focused` | frozen — [§ frozen tree](#frozen-tree) | no |
| `commit` | none | stage | yes |
| `pre-merge-validation` | `full` | revert `.only` | no |

Tiers: `unit-focused` = Jest + optional `.only`/narrow e2e for **diagnosis only**; closing `implementation` still follows [platform coverage](running-e2e.md#platform-coverage-gate-blocking) and [lint-by-tree](validation-checklist.md#lint-and-formatting). `area-focused` = full area, no `.only`, frozen for review. `full` / `pre-merge-validation` = [platform coverage](running-e2e.md#platform-coverage-gate-blocking) **and** the lint-by-tree / evidence rows that already apply for this diff; not automatically both platforms; CI e2e jobs are not the pass signal.

<a id="gates"></a>

## Gates

| Gate | Closes when |
|------|-------------|
| `implementation` (`implementation_gate`) | Unit-focused green; [platform coverage](running-e2e.md#platform-coverage-gate-blocking); [lint](validation-checklist.md#lint-and-formatting) |
| `independent-review` (`review_gate`) | `documentation?` already done when OKF/`AGENTS.md`/`CONTRIBUTING.md`/user docs changed; area-focused green on frozen tree; **all** findings fixed ([§ quality](#quality-standards)); apply per [§ frozen tree](#frozen-tree) (not every finding → `documentation?`); OKF scan when `okf-bundle/`, `AGENTS.md`, or `CONTRIBUTING.md` is in the frozen tree |
| `coverage_evidence_gate` | Closes per [coverage evidence](coverage-design.md#coverage-evidence-package) (`n/a` unless the diff includes `src/` **or** `android/` **or** `ios/` **or** `plugin/` TS; `app.plugin.js`-only is `n/a` unless `plugin/` TS changed — plugin Jest still follows [§ Expo plugin](validation-checklist.md#expo-plugin)) |
| `commit` (`commit_gate`) | Prior gates closed with [evidence package](validation-checklist.md#validation-evidence-package) |
| `pre-merge-validation` | [Validation-checklist work types](validation-checklist.md#work-types) pre-merge row recorded (platform coverage + lint/evidence); CI e2e is not the pass |

Open `review_gate` = unverified.

<a id="validation-evidence-blocking"></a>

### Validation evidence

**Blocking.** Record the [validation evidence package](validation-checklist.md#validation-evidence-package). No exit codes / log paths → gate stays open.

<a id="quality-standards"></a>

## Quality standards

Finding severity and close-rule: [§ review findings](#review-findings). Exceptions: [§ acceptable exceptions](#acceptable-exceptions).

<a id="acceptable-exceptions"></a>

### Acceptable exceptions

Only with **user confirmation**: (1) intractable platform/SDK/toolchain limit + evidence, or (2) user deferral + rationale. Testable code gets a test or is deleted.

<a id="review-findings"></a>

### Review findings

Findings `critical`/`serious`/`minor`/`nit`. `review_gate` closes only when all are fixed or an [exception](#acceptable-exceptions) applies. Where to apply: [§ frozen tree](#frozen-tree) — split by **what failed**, not every frozen finding → `documentation?`.

<a id="frozen-tree"></a>

## Frozen tree

No edits during `independent-review` except revert `.only`: product trees (above); `okf-bundle/`; `AGENTS.md`; `CONTRIBUTING.md`. This pass is report-only ([lint-and-formatting](validation-checklist.md#lint-and-formatting), [OKF bundle review](validation-checklist.md#okf-bundle-review)). Follow-up owner is **what failed**: findings in `okf-bundle/` / `AGENTS.md` / `CONTRIBUTING.md` → new `documentation?`, then another frozen scan; findings in product / tests / lint (including iOS `:fix` after check failure, and Android format) → `implementation`. Do not send every frozen-review finding to `documentation?`. Separate implementation/`documentation` and review passes.

<a id="host-rule"></a>

## Host rule

[Pre-flight](running-e2e.md#pre-flight) each run (prepare finished, Metro is this checkout). Canonical e2e: [local e2e commands](running-e2e.md#local-e2e-commands) only.

<a id="implementation"></a>

## Implementation

[Pre-flight](running-e2e.md#pre-flight) → edit → [platform coverage](running-e2e.md#platform-coverage-gate-blocking) and [lint-by-tree](validation-checklist.md#lint-and-formatting) for this diff (Jest only if that table or [evidence](validation-checklist.md#validation-evidence-package) requires it).

Native GMA/UMP calls: read each platform’s official API; don’t copy Android fixes to iOS without checking; record citations in ephemeral session scratch under `.agents/`.

`.only` or a single e2e file is allowed for `unit-focused` diagnosis only. Revert before `area-focused` / `full`. Never commit `.only`. Diagnosis steps: [running e2e § diagnosis](running-e2e.md#e2e-diagnosis).

<a id="commit"></a>

## Commit

One focused commit when `commit_gate` closes. Before `git commit`, scan for `.only` with the [registry](agent-command-policy.md#canonical-registry) `.only` scan command. Never stage `.only`. Do not stage ephemeral `.agents/` content; its tracked-infrastructure exception and the ban on ephemeral files under `okf-bundle/` are canonical in the [documentation policy](../documentation-policy.md#durable-vs-ephemeral). Before `git commit`, stage `commit_subject` in ephemeral gate state in the internal tracker (not under `.agents/`) to the commit's subject line and close `commit_gate`. Do not record SHAs. After commit, the git subject and staged `commit_subject` must match character-for-character. Single-commit PR titles: [documentation-policy § pull requests](../documentation-policy.md#pull-requests).

Gate-state fields (`next_work_type`, `commit_subject`, and related fields per [iteration vocabulary](iteration-vocabulary.md)) are ephemeral and never live in GitHub-public docs. Gate state lives in the internal tracker per [documentation policy](../documentation-policy.md#efficiency). Staging, SHA ban, and character-match for `commit_subject` are this section.
