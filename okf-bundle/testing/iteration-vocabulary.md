---
type: Reference
title: Iteration vocabulary
description: Work-type, tier, and gate-state field identifiers — not procedures.
tags: [testing, validation, workflow]
timestamp: 2026-08-22T00:00:00Z
---

# Iteration vocabulary

Identifiers only. Procedures: [change authoring](change-authoring-workflow.md). Commands: [agent command policy](agent-command-policy.md). Policy: [documentation policy](../documentation-policy.md).

Order is **not** implied by this table; sequence: [change authoring § loop](change-authoring-workflow.md#loop).

| Work type | Meaning |
|-----------|---------|
| `gap-analysis` | Read-only feasibility / semantics |
| `baseline-capture` | Before snapshots |
| `implementation` | Product code + tests |
| `documentation` | User docs + durable OKF + `AGENTS.md` + `CONTRIBUTING.md` |
| `independent-review` | Frozen-diff verify |
| `commit` | One focused commit |
| `pre-merge-validation` | Branch merge gate |

| Tier | Meaning |
|------|---------|
| `unit-focused` | Fast, while code is changing |
| `area-focused` | Full area spec |
| `full` | [Platform coverage](running-e2e.md#platform-coverage-gate-blocking) **and** lint-by-tree / evidence for this diff; not automatically both platforms; CI e2e jobs are not the pass signal |

Gate-state fields (`open`\|`closed` unless noted): `next_work_type`, `validation_tier`, `platform`, `implementation_gate`, `review_gate`, `commit_gate`, `coverage_evidence_gate` (`open`\|`closed`\|`n/a`), `commit_subject` (planned or landed Conventional Commits first line), `blocked`.

State only — not who executes. Gate close rules: [change authoring § gates](change-authoring-workflow.md#gates). `commit_subject` match and staging: [change authoring § commit](change-authoring-workflow.md#commit).
