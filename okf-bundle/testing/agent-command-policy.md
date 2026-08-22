---
type: Reference
title: Agent command policy
description: Allowlisted agent shell commands.
tags: [testing, validation, agents, yarn]
timestamp: 2026-08-19T00:00:00Z
---

# Agent command policy

If a command is not listed (or linked) here, **do not run it**. E2e detail: [running e2e](running-e2e.md#agent-rule-read-first).

1. Registry only, repo root unless noted.
2. `yarn` then `yarn prepare` exit 0 before tsc/Jest/lint/Metro/native — [§ prepare](#prepare-must-finish-first).
3. On failure: fix product (or re-`yarn`), re-run the **same** command.
4. Paste [handoff](#subagent-handoff) into subagent prompts.

## Canonical registry

| Intent | Command | Never |
|--------|---------|-------|
| Install | `yarn` | `npm install`; example-only install first |
| Example deps | `yarn tests:install` | `npm install` in example |
| `src/` → `lib/` + plugin | `yarn prepare` | ad-hoc bob/babel/tsc |
| TS check | `yarn tsc:compile` | invented `tsc` configs |
| Jest | `yarn tests:jest`, `yarn tests:jest-coverage` | `npx jest` random cwd |
| Lint CI | `yarn lint:code` | ad-hoc eslint |
| Lint + tsc | `yarn lint` | invented combos |
| JS / Java / ObjC | `yarn lint:js`, `yarn lint:android`, `yarn lint:ios:check` / `:fix` | `npx google-java-format` |
| Docs | `yarn lint:markdown:check`, `yarn lint:spellcheck` | ad-hoc prettier as gate |
| Packager | `yarn tests:packager`, `yarn tests:packager:reset-cache` | bare Metro |
| Android | `yarn tests:android:build`, `yarn tests:android:run` | ad-hoc `./gradlew` |
| iOS | `yarn tests:ios:pod:install`, `yarn tests:ios:run` | ad-hoc `pod` |
| E2e | [running e2e](running-e2e.md) `yarn tests:*` | `jet`, `npx jet`, `detox test` |

<a id="prepare-must-finish-first"></a>

## Prepare must finish first

`yarn` / `yarn prepare` are blocking (genversion → bob → plugin). Metro reads `lib/`. Do not parallelize with Jest/tsc/Gradle/pods.

Sandbox with no exit status on e2e/packager/Gradle/pods: retry the **same** command unrestricted.

Traps: `genversion` via `yarn prepare` only. Example is `portal:../` — prepare before Metro. CI lint = `yarn lint:code`; CI tsc = `yarn tsc:compile`; docs CI = `yarn lint:spellcheck`.

<a id="subagent-handoff"></a>

## Subagent handoff

```text
RNGMA: okf-bundle/testing/agent-command-policy.md ONLY. E2e: running-e2e.md yarn tests:* ONLY.
Never jet/npx jet/detox/npm install/ad-hoc gradlew/google-java-format.
yarn then yarn prepare exit 0 before anything else. Same command on retry.
Gates: validation-checklist.md#validation-evidence-package (+ coverage-design.md#coverage-evidence-package if src/native/plugin).
```
