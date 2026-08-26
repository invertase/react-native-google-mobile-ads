---
type: Reference
title: Validation checklist
description: Validation command sequence.
tags: [testing, validation, jest, lint]
timestamp: 2026-08-22T00:00:00Z
---

# Validation checklist

Coverage: [coverage design](coverage-design.md). Tiers: [change authoring](change-authoring-workflow.md). Sequence uses [canonical registry](agent-command-policy.md#canonical-registry) names. E2e: [local e2e commands](running-e2e.md#local-e2e-commands).

<a id="work-types"></a>

| Work type | Run |
|-----------|-----|
| `gap-analysis` | Read APIs/docs |
| `baseline-capture` | Only the [platform coverage](running-e2e.md#platform-coverage-gate-blocking) rows for this diff; no `.only` |
| `implementation` | [Platform coverage](running-e2e.md#platform-coverage-gate-blocking) and [lint-by-tree](#lint-and-formatting) for this diff; `.only` local OK |
| `documentation` | Promote durable OKF / user docs / `AGENTS.md` / `CONTRIBUTING.md`. [Lint](#lint-and-formatting) if `docs/**`. **Do not** run the independent OKF scan here. |
| `independent-review` | Rows that apply to **this** diff ([platform coverage](running-e2e.md#platform-coverage-gate-blocking), check-only [lint-by-tree](#lint-and-formatting)), frozen, no `.only`. [OKF scan](#okf-bundle-review) when the frozen tree includes `okf-bundle/`, `AGENTS.md`, or `CONTRIBUTING.md`. |
| `pre-merge-validation` | [Platform coverage](running-e2e.md#platform-coverage-gate-blocking) for this diff; [lint-by-tree](#lint-and-formatting) / evidence rows that already apply; CI e2e jobs are not the pass signal |

<a id="lint-and-formatting"></a>

## Lint and formatting

This heading owns lint-by-tree, check vs `:fix`/`--replace` by work type, and when markdown check applies. Registry hops here: [canonical registry](agent-command-policy.md#canonical-registry), [constraints block](agent-command-policy.md#constraints-block).

**Check vs format.** `implementation` and `documentation`: after a check failure, run the allowlisted `:fix` then re-check. `yarn lint:android` already `--replace` (and `--set-exit-if-changed`). `independent-review` is **check-only** on the frozen tree ([§ frozen tree](change-authoring-workflow.md#frozen-tree)): run matching **check** commands; do not run `lint:ios:fix` or `lint:markdown:fix`. Frozen `independent-review` does **not** run `yarn lint:android` because that script is `--replace` only; Android format is not a frozen-pass check — apply it in `implementation`. Do not invent `npx google-java-format` or a check-only yarn name. A check failure is a finding; apply per [§ frozen tree](change-authoring-workflow.md#frozen-tree) (product/lint including iOS `:fix` and Android format → `implementation`; markdown format when `docs/**` → `documentation`).

**Which trees.** `yarn lint:js` only if `packages/core/src/` (script scope is `packages/core/src/`). Plugin JS: [Expo plugin](#expo-plugin) Jest, not `lint:js`. `packages/core/__tests__/` is not in `lint:js`. `yarn lint:android` if `packages/core/android/` **and** the work type may `--replace` (`implementation` / `documentation`) — formats **Java** only. Android **Kotlin** (`.kt`): repo-root `./gradlew ktlintFormat` when `packages/core/android/` has `.kt` changes and the work type may format (`implementation` / `documentation`; optional `-PinternalKtlintGitFilter`). Frozen `independent-review` runs `./gradlew ktlintCheck` only (not `ktlintFormat`, like `lint:android`). Optional local hook: `./gradlew addKtlintFormatGitPreCommitHook`; Invertase global pre-commit also invokes root `./gradlew ktlintFormat` when present — this repo does not ship an installed hook. `yarn lint:ios:check` if `packages/core/ios/`. `yarn lint:code` only when this diff includes `packages/core/src/` **and** `packages/core/android/` **and** `packages/core/ios/` **and** the work type may `--replace`; never as a stand-in for a single-tree lint; never on frozen `independent-review` (`yarn lint:code` / `yarn lint` include `lint:android`, which is `--replace`-only — see **Check vs format**). `yarn lint` is `lint:code` plus `tsc:compile` (same three-tree rule). Frozen three-tree: `lint:js`, `./gradlew ktlintCheck` (when `.kt` is in scope), and `lint:ios:check` only.

**Docs.** `yarn lint:markdown:check` and `yarn lint:spellcheck` **only** when the diff includes `docs/**`. Independent-review of `okf-bundle/` / `AGENTS.md` / `CONTRIBUTING.md` with **no** `docs/**` does **not** run markdown check or `lint:markdown:fix`. CI docs job is spellcheck only; markdown check is local. Allowlist: [agent command policy](agent-command-policy.md). User-docs sidebar: [documentation site maintenance](../documentation-site-maintenance.md).

<a id="expo-plugin"></a>

## Expo plugin

**Blocking when the diff touches `packages/core/plugin/` or `packages/core/app.plugin.js`.** [GMA-AD-1](../architecture-decisions.md#gma-ad-1): `yarn prepare` (includes `build:plugin`) then **root** `yarn tests:jest packages/core/plugin/__tests__/`. Root Jest is the gate. `packages/core/plugin/jest.config.js` exists for expo-module-scripts; do not invoke it instead of root Jest, and do not delete it as “invented.”

E2e vs plugin Jest: [platform coverage](running-e2e.md#platform-coverage-gate-blocking).

<a id="okf-bundle-review"></a>

## OKF bundle review

This scan **is** `independent-review` of the frozen tree when `okf-bundle/`, `AGENTS.md`, or `CONTRIBUTING.md` is in that tree ([change authoring § loop](change-authoring-workflow.md#loop)). Do not run it during `documentation` (that work type only promotes durable text). This scan does **not** run `yarn lint:markdown:check` / `lint:markdown:fix` unless `docs/**` is also in the frozen tree ([§ lint](#lint-and-formatting)). Run the [OKF update contract](../documentation-policy.md#okf-update-contract):

1. Confirm durable learnings landed in the owning `okf-bundle/` doc. If the frozen tree is `AGENTS.md`-only or `CONTRIBUTING.md`-only, still confirm those files against the [OKF update contract](../documentation-policy.md#okf-update-contract) rows that apply to them, and still complete step 3.
2. Check `okf-bundle/testing/` for conflicts with verified behavior; report drift (do not edit on this frozen pass).
3. Independent scan of the **entire** `okf-bundle/` tree **and** `AGENTS.md` / `CONTRIBUTING.md` (an `AGENTS.md`-only or `CONTRIBUTING.md`-only frozen tree still scans all three). Include a short summary of what changed and which files were touched. Confirm every contract row: Canonical location, DRY, [Efficiency](../documentation-policy.md#efficiency), link hygiene, Durability. This frozen scan **reports only** ([§ frozen tree](change-authoring-workflow.md#frozen-tree)). Apply `okf-bundle/` / `AGENTS.md` / `CONTRIBUTING.md` findings in a new `documentation?` pass, then another frozen scan — product/lint findings are [§ frozen tree](change-authoring-workflow.md#frozen-tree) (`implementation`), not this dump. Close `commit` only with a clean scan: [OKF update contract](../documentation-policy.md#okf-update-contract) and [§ commit](change-authoring-workflow.md#commit). Gate close is not a later escape hatch.

Goal: each iteration improves OKF and removes conflicting guidance. The contract owns check meanings; this scan hops there — do not skip the hop by treating this list as a thinner substitute.

<a id="validation-evidence-package"></a>

## Validation evidence package

**Blocking.** Record this table before closing gates or pushing. History rewrite invalidates it. E2e: Android/iOS named-script trios on [platform coverage](running-e2e.md#platform-coverage-gate-blocking); [local e2e](running-e2e.md#local-e2e-commands) is the name list and tee only. Apply only the rows this diff requires.

| Step | Command | Exit | Evidence |
|------|---------|------|----------|
| prepare | `yarn prepare` | 0 | if `packages/core/src/` or `packages/core/plugin/` or `packages/core/app.plugin.js` (or `packages/core/lib/` is stale) |
| tsc | `yarn tsc:compile` | 0 | if `packages/core/src/` or `packages/core/plugin/` or `packages/core/app.plugin.js` |
| jest | `yarn tests:jest <paths>` | 0 | N/N — if `packages/core/src/`, `packages/core/plugin/`, or `packages/core/__tests__/` |
| e2e iOS / Android | Android/iOS named-script trios on [platform coverage](running-e2e.md#platform-coverage-gate-blocking); [names + tee](running-e2e.md#local-e2e-commands) | 0 | counts + `/tmp/rngma-e2e-*.log` — only if that table requires e2e |
| lint | [§ lint](#lint-and-formatting) for this diff (`lint:js` only if `packages/core/src/`; not plugin; not `packages/core/__tests__/`). `yarn lint:code` / `yarn lint` only when this diff includes `packages/core/src/` **and** `packages/core/android/` **and** `packages/core/ios/` and the work type may `--replace` | 0 | matching linters |
| docs | `yarn lint:markdown:check` and `yarn lint:spellcheck` | 0 | if `docs/**` — [§ lint](#lint-and-formatting) |
| plugin | `yarn tests:jest packages/core/plugin/__tests__/` | 0 | if `packages/core/plugin/` or `packages/core/app.plugin.js` — [§ Expo plugin](#expo-plugin) |
| coverage | [evidence package](coverage-design.md#coverage-evidence-package) | — | required when `packages/core/src/` **or** `packages/core/android/` **or** `packages/core/ios/` **or** `packages/core/plugin/` TS; `packages/core/app.plugin.js`-only is `n/a` unless plugin TS changed |
| OKF scan | [§ OKF bundle review](#okf-bundle-review) | pass | if frozen tree includes `okf-bundle/`, `AGENTS.md`, or `CONTRIBUTING.md` — not during `documentation`; gate close is not a skip |
