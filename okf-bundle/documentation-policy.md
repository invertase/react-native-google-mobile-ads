---
type: Reference
title: OKF documentation and commit policy
description: Canonical rules for public vs ephemeral vs private knowledge, commit messages, and post-update bundle consistency.
tags: [okf, documentation, policy, commits]
timestamp: 2026-08-22T00:00:00Z
---

# OKF documentation and commit policy

Single source of truth for OKF knowledge and commit wording. Other OKF docs link here; do not restate.

<a id="durable-vs-ephemeral"></a>

## Public vs ephemeral vs private

| Kind | Where it lives | What it contains |
|------|----------------|------------------|
| **Public (durable)** | GitHub-**public** reference docs and indexes under `okf-bundle/` | Stable API names, registry IDs, SDK versions, classifications, verification **methods**, architecture, canonical commands |
| **Ephemeral** | **Gitignored** working files in the checkout, all under `.agents/` | Session scratch only: run counts, snapshot labels, dated banners, interim report copies, coverage evidence paths (`.agents/reports/<change-id>/`), probe notes — never staged |
| **Private** | Internal tracker and internal docs (not named here) | Tracker identifiers, discussion, non-public commercial terms. Not GitHub-public; not the same as ephemeral |

GitHub-public **reference** docs, `AGENTS.md`, commits, and PR titles must **not** contain ephemeral **state/values** (for example probe IDs, dated banners, run counts) or private **items** (for example tracker identifiers, internal docs). Gate **names** and close rules: [change authoring § gates](testing/change-authoring-workflow.md#gates).

Ephemeral working files are **gitignored and never staged**. In this checkout that means everything under `.agents/`. Do not add ephemeral files under `okf-bundle/`.

Private items stay off GitHub, including off `AGENTS.md`, commits, PR titles, and reference docs.

**Rules**

1. General OKF docs get **public/durable only** updates. Ephemeral fields and private items stay out of all GitHub-public **reference** docs (this heading defines the kinds; it is not the only file the restriction covers).
2. Ephemeral state has two layers: **session scratch** lives only in gitignored `.agents/`; **gate state** lives only in the internal tracker (ephemeral for durability purposes). When an item closes, **public** outcomes move to reference docs; session scratch stays under `.agents/` and gate state stays in the tracker.
3. GitHub-public **reference** docs must not link to gitignored files — they are not on GitHub.

<a id="commits-as-documentation"></a>

## Commits as documentation

We treat **git commits** as durable documentation: they are the canonical record of what changed, when, and why — for humans and agents reviewing history later, not only for the current PR thread.

Commit messages use [Conventional Commits](https://www.conventionalcommits.org/) and describe durable product/process deliverables: what changed and why, not probe IDs, gates, e2e counts, or “phase X complete”.

<a id="pull-requests"></a>

## Pull requests

Commit subjects and PR titles use [Conventional Commits](https://www.conventionalcommits.org/). When a PR contains **exactly one commit**, the **PR title must match that commit's subject line exactly** (character-for-character). Multi-commit PRs use a summary title that describes the overall change set.

PRs are squash-merged. Maintainers or agents may amend or squash to **fix** a non-conforming subject so the published commit is Conventional Commits. That is an exception flow to repair a violation, not permission to skip the format on commits.

<a id="okf-update-contract"></a>

## OKF update contract

OKF markdown edits require an **independent bundle consistency pass**:

1. A short summary of what changed and which files were touched.
2. Instruction to scan the **entire** `okf-bundle/` tree.

Confirm:

| Check | Requirement |
|-------|-------------|
| **Canonical location** | Each topic has one owning doc; others link to it. Bundle owners: [index.md](index.md). Testing owners: [testing/index.md](testing/index.md) (file **and** section links). |
| **DRY** | No duplicated procedures, policy paragraphs, or ephemeral snapshots in GitHub-public docs |
| **Efficiency** | Shortest text that stays **complete and true** ([§ Efficiency](#efficiency)). Completeness wins over brevity |
| **Link hygiene** | Cross-links resolve; indexes list canonical entry points |
| **Durability** | No ephemeral **state/values** and no private **items** in GitHub-public **reference** docs, `AGENTS.md`, commits, or PR titles. Private items stay off GitHub. Ephemeral working files are gitignored under `.agents/` and never staged. Do not add ephemeral files under `okf-bundle/` |

**Blocking on `commit`.** Fix violations before `git commit` ([change authoring § commit](testing/change-authoring-workflow.md#commit)). Gate close is not a later escape hatch. Frozen `independent-review` **reports only**; `okf-bundle/` / `AGENTS.md` / `CONTRIBUTING.md` findings apply in `documentation?` then another frozen scan — product/lint findings are not this dump ([§ frozen tree](testing/change-authoring-workflow.md#frozen-tree)). Commands: [validation-checklist § OKF bundle review](testing/validation-checklist.md#okf-bundle-review). Loop: [change authoring](testing/change-authoring-workflow.md#loop).

<a id="efficiency"></a>

## Efficiency

Efficiency is **information-preserving brevity**, not a token budget.

**Pass when:**

- Non-owning docs **link** to the owner instead of copying procedures, policy paragraphs, or command lists.
- Sentences and tables are as short as they can be **without** dropping a rule, case, exception, location, dual path (for example single- vs multi-commit PR titles), blocking step, or inbound heading id.
- Index and `AGENTS.md` summaries remain **true**: every distinction an agent needs in order to act correctly is either stated or linked with enough qualifier that the wrong place or rule cannot be assumed.

**Fail when:**

- A shorter owner doc omits a requirement that existed, or that other docs still depend on.
- A summary collapses two cases into one.
- A heading rename breaks `#fragment` links.
- “Don’t restate” is used to skip updating `AGENTS.md` or indexes after a policy change.

If shortening would change how an agent acts, keep the longer text.

**`.agents/`** files are gitignored and never staged — session scratch only ([table above](#durable-vs-ephemeral)).

Gate state (`next_work_type`, gates, `commit_subject`, and related fields) lives in the **internal tracker** (session trackers outside this repo). It is ephemeral for durability purposes but is not maintained under `.agents/` and is not described here. Field names: [iteration vocabulary](testing/iteration-vocabulary.md). Gate semantics and `commit_subject` staging: [change authoring workflow](testing/change-authoring-workflow.md#commit).
