---
type: Reference
title: Coverage design
description: Touched-line coverage and evidence package.
tags: [testing, coverage, jest]
timestamp: 2026-08-19T00:00:00Z
---

# Coverage design

| Layer | Command |
|-------|---------|
| Jest (`src/**`, not `src/version.ts`) | `yarn tests:jest-coverage` |
| E2e | `yarn tests:android:run` / `yarn tests:ios:run` |

CI Codecov: Jest + e2e jobs. Review signal = **touched files**. Native Jacoco/LCOV yarn targets do not exist yet — do not invent them; Jest + e2e counts stay blocking until native coverage tooling lands.

New code: coverage only rises; **100% reachable touched TS**. Else [acceptable exception](change-authoring-workflow.md#acceptable-exceptions) or delete dead code.

<a id="coverage-evidence-package"></a>

## Coverage evidence package

**Blocking.** Required for `review` when diff touches `src/**`, `android/**`, `ios/**`, or `plugin/**` (native/plugin also need e2e). Write `.agents/reports/<item>/coverage-evidence.md`: artifacts + timestamps; per-file %; branch → test; every gap (fix / delete / exception). Verdict: `100% on reachable touched lines` or `NOT 100%` with dispositions. Missing package = blocking finding.
