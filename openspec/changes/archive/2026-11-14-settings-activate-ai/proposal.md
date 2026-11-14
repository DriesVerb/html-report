## Why

Today a report only shows the agent bridge if the DOM happens to contain agent triggers, and nothing tells a visitor how to enable it. Making AI an explicit, discoverable setting lets any board opt in, and gives each board its own copy-paste turnkey that starts the bridge for that exact file.

## What Changes

- Settings → AI section with an **Activate AI** toggle per board.
- When activated and the bridge is offline, show a turnkey card with a copy-ready prompt (and status/retry) for that board.
- Make `isAiCapable()` the single source of truth consumed by the editor (Story 1) and the status badge.

**Out of scope**
- No bundled API keys or cloud model; the bridge still uses the user's local `agy`.
- No change to bridge protocols.

## Capabilities

### New Capabilities
- `ai-activation`: A setting to mark a report as AI-capable, with a one-click turnkey to bring up the agent bridge for each board.

### Modified Capabilities
- None (no existing main spec covers the report shell navbar)

## Impact

- `skills/html-report/assets/template-shell.html`, `skills/html-report/assets/report-runtime.js`, `skills/html-report/scripts/build-report.mjs`
- Order: 3 of 4 (depends on gear menu; completes editor hand-off). Part of the epic: gear-settings-menu → page-edit-prompt-editor → settings-activate-ai.
- Companion journey page: [index.html](./index.html)

## Assumptions (please confirm)

- Tasks persist in browser localStorage per page in v1.
- "Board" means one report page; a directory-wide board list is optional v1.1.
- Agent edits run through the existing local `agy` bridge, localhost only.
