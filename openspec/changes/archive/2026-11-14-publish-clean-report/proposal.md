## Why

Reports are iteratively authored using the bottom-dock editor and agent bridge. Once editing is finalized, stakeholders and public audiences need a clean, uncluttered deliverable without developer tools, gear menus, or prompt editors. Offering a deterministic publish flow guarantees that exported reports are completely self-contained, pristine, and byte-reproducible across identical builds.

## What Changes

- Provide a clear 'Set as Published' toggle and 'Download Clean HTML' action in the Settings panel.
- Produce a deterministic standalone HTML download that cleanly omits the gear icon (`#settings-dropdown`), bottom edit dock (`#edit-dock`), and authoring chrome.
- Ensure zero authoring script footprint or residual task draft queues in the published bundle.
- Support a deterministic CLI/build flag (`--published` in `build-report.mjs`) to generate clean, gear-free reports in headless pipelines.
- Guarantee deterministic serialization: no timestamps, no non-deterministic session tokens, completely reproducible byte-for-byte.

**Out of scope**
- Does not delete draft tasks from the author's local browser storage (keeps drafts safe for future edits on the development page).
- Does not alter reader features (charts, Mermaid diagrams, TOC, print stylesheets, and tables remain 100% interactive).

## Capabilities

### New Capabilities
- `publish-clean-export`: Mark a report as published and download a deterministic, production-grade standalone HTML bundle stripped of the gear icon, edit dock, and draft authoring chrome.

### Modified Capabilities
- None (no existing main spec covers the report shell navbar)

## Impact

- `skills/html-report/assets/template-shell.html`, `skills/html-report/assets/report-runtime.js`, `skills/html-report/scripts/build-report.mjs`
- Order: 4 of 4 (completes publishing lifecycle). Part of the epic: gear-settings-menu → page-edit-prompt-editor → settings-activate-ai.
- Companion journey page: [index.html](./index.html)

## Assumptions (please confirm)

- Tasks persist in browser localStorage per page in v1.
- "Board" means one report page; a directory-wide board list is optional v1.1.
- Agent edits run through the existing local `agy` bridge, localhost only.
