## Why

Reviewing a report produces a stream of small change requests (fix this chart, reword that heading). Today they live in your head or a chat. A per-page task queue lets you capture them in place while reading, rank them, and hand the agent one clean, reproducible prompt. Everything is deterministic and baked into every html-report, so no LLM is needed to build the prompt.

## What Changes

- Gear → Edit opens a compact editor docked to the bottom edge of the screen.
- Create tasks (title + content), list them in a Queue tab, prioritize them, mark them done.
- Generate a deterministic prompt from the queue; copy it, or send it straight to the agent when the page is AI-capable and connected.
- Scroll-following: the dock stays put while you read and shows which section you are in, so tasks attach to what you see.
- AI-capable but offline: surface the turnkey reconnect flow instead of a dead button.

**Out of scope**
- No server-side persistence of tasks in v1 (localStorage per page).
- No multi-user collaboration or sync.
- The prompt is not LLM-generated; it is a pure template function.

## Capabilities

### New Capabilities
- `page-edit-queue`: A slim, bottom-docked AI-prompt-style editor to collect edit tasks for this page, prioritize them, and turn them into one agent-ready prompt.

### Modified Capabilities
- None (no existing main spec covers the report shell navbar)

## Impact

- `skills/html-report/assets/template-shell.html`, `skills/html-report/assets/report-runtime.js`, `skills/html-report/scripts/serve-report.mjs`, `skills/html-report/scripts/build-report.mjs`
- Order: 2 of 4 (depends on gear menu). Part of the epic: gear-settings-menu → page-edit-prompt-editor → settings-activate-ai.
- Companion journey page: [index.html](./index.html)

## Assumptions (please confirm)

- Tasks persist in browser localStorage per page in v1.
- "Board" means one report page; a directory-wide board list is optional v1.1.
- Agent edits run through the existing local `agy` bridge, localhost only.
