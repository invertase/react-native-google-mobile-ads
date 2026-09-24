---
type: Reference
title: Documentation site maintenance
description: Canonical maintenance for docs.page (docs.json + docs/).
tags: [okf, documentation, docs-page]
timestamp: 2026-08-22T00:00:00Z
---

# Documentation site maintenance

Single source for **user-facing documentation site** maintenance: [docs.page](https://docs.page) content under `docs/` plus root `docs.json`.

**Policy:** [OKF documentation and commit policy](documentation-policy.md).

This repo does **not** publish a TypeDoc `/reference/` site. Do not invent `yarn reference:api`, TypeDoc configs, or legacy `/reference/` redirect audits unless those tools exist here.

<a id="docsjson"></a>

## docs.json

When adding or renaming user docs pages:

- Add or update sidebar entries in `docs.json` in the same change as `docs/**`.
- Paths in the sidebar are docs.page routes (for example `/ad-formats`), not GitHub file paths.
- Run markdown/spellcheck per [validation checklist § lint](testing/validation-checklist.md#lint-and-formatting).

`docs.json` **does** use `redirects` for the IA cutover (old paths → current sidebar routes). Treat that object as the source of truth; keep entries in sync when renaming or removing user-facing routes. Current map: `/displaying-ads` → `/ad-formats`, `/displaying-ads-hook` → `/ad-formats/hooks`, `/native-ads` → `/ad-formats/native`. Do not invent a separate redirect-audit procedure beyond that map.

## Related

- User docs live in `docs/`. Integrator agent steering ships in `packages/core/AGENTS.md` (npm); root `AGENTS.md` is the maintainer path and redirects integrators there. Maintainer/agent knowledge lives in `okf-bundle/` — [documentation policy](documentation-policy.md).
- CI docs job: `.github/workflows/docs.yml` — [§ lint](testing/validation-checklist.md#lint-and-formatting) (spellcheck in CI; markdown check is local).
