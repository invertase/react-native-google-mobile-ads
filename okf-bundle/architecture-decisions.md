---
type: Reference
title: Architecture decisions (ADR)
description: Canonical owner of durable GMA product and tooling decisions.
tags: [okf, adr]
timestamp: 2026-08-22T00:00:00Z
---

# Architecture decisions (ADR)

**Canonical owner** of durable “what + why” decisions for this repo. Procedures and commands live in [testing](testing/index.md). Do not duplicate these decisions in work queues. Queues stay under `.agents/work-queues/` (gitignored).

**Policy:** [OKF documentation policy](documentation-policy.md).

## Decision ID convention

Cite decisions as **`GMA-AD-<n>`**.

## Status legend

| Status | Meaning |
|--------|---------|
| **Accepted** | Decided; follow this. |
| **Proposed** | Planned; not yet the rule. |
| **Rejected** | Considered and declined; keep so it is not re-litigated. |

Add rows when a refactor choice lands (module boundaries, codegen, plugin behavior, native backend). Do not paste decisions from other repos.

<a id="gma-ad-1"></a>

## GMA-AD-1 — Expo config plugin is a separate validation path — **Accepted**

The Expo config plugin under `plugin/` is not covered by native e2e alone.

**When `plugin/` or `app.plugin.js` changes:**

| Check | Why |
|-------|-----|
| `yarn prepare` exit 0 | Root `prepare` runs `build` then `build:plugin` (`tsc --build plugin`). Metro/Expo consume compiled plugin output, not `plugin/src/` |
| `yarn tests:jest plugin/__tests__/` exit 0 | Plugin fixture tests (`plugin/__tests__/plugin.test.ts`) match the root Jest regex; do not invent a second test runner |

Do not invent attw, `yarn attw:check`, or a consumer-matrix type gate. Those tools are not in this repo.

Handoff: [validation checklist § Expo plugin](testing/validation-checklist.md#expo-plugin).
