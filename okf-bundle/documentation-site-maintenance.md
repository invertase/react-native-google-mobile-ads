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
- Paths in the sidebar are docs.page routes (for example `/displaying-ads`), not GitHub file paths.
- Run markdown/spellcheck per [validation checklist § lint](testing/validation-checklist.md#lint-and-formatting).

Redirect keys in `docs.json` are not in use today. Do not add a redirect-audit procedure until this repo actually has `redirects`.

## Related

- User docs live in `docs/`. Agent knowledge lives in `okf-bundle/` — [documentation policy](documentation-policy.md).
- CI docs job: `.github/workflows/docs.yml` — [§ lint](testing/validation-checklist.md#lint-and-formatting) (spellcheck in CI; markdown check is local).
