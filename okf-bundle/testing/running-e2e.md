---
type: Reference
title: Running e2e tests
description: Canonical e2e yarn tests:* commands.
tags: [testing, e2e, ios, android]
timestamp: 2026-08-19T00:00:00Z
---

# Running e2e tests

<a id="agent-rule-read-first"></a>

## Agent rule

Use **only** these scripts. No direct Jet/Metro/Gradle/`pod`. Install: [agent command policy](agent-command-policy.md).

Once: `yarn && yarn prepare && yarn tests:install` (+ `yarn tests:ios:pod:install` on iOS).

```bash
yarn tests:packager                 # reset: tests:packager:reset-cache
yarn tests:android:build && yarn tests:android:run
yarn tests:ios:pod:install && yarn tests:ios:run
```

Specs: `e2e/*.e2e.js`. App: `RNGoogleMobileAdsExample/`. Logs: `/tmp/rngma-e2e-android.log`, `/tmp/rngma-e2e-ios.log`. One e2e at a time (`:8081`). No source edits during a run.

JS-only `src/`: `yarn prepare` + packager reset; native `:build` not required. Native/codegen/plugin: rebuild then run.

<a id="platform-coverage-gate-blocking"></a>

## Platform coverage gate

Touched `android/**`, `ios/**`, plugin native config, podspec, or `src/specs/**` → e2e on **each affected platform** before impl/review gates. No macOS e2e script.

<a id="pre-flight"></a>

## Pre-flight

Prepare current if `src/`/`plugin/` changed; Metro is this checkout; no overlapping runs; revert `.only` before area-focused/full.

Interrupted Shell: log footer `N passing`/`N failing` = complete; else recover Metro `:8081` and re-run the **same** command.

Merge: no `.only`; **full** = Jest coverage + `lint:code` + tsc + both platforms if native/example wiring changed.
