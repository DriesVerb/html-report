# Proposal: Edit Mode Queue Task Re-Editing & Document Style Editor

> **Domain:** `Edit Mode` & `Custom Themes` | **Beneficiary:** `Hybrid` (Human Author + Agent Loop) | **Two-Axis Classification:** `Static / Server-Connected` + `Interactive / Reactive` | **Journey Companion:** [index.html](index.html)

## Why

In **Edit Mode** (`#edit-dock`), users capture edit requests in the **Compose** tab and manage them in the **Queue** tab, while report styling currently requires either editing CLI flags (`--theme`, `--custom-theme`), returning to `Create Mode`, or switching browser-local previews in the top navbar dropdown (which do not persist as the document's default style). Two workflow gaps slow down iterative authoring:

1. **No In-Dock Way to Re-Edit a Queued Task:** Although `HTMLReportEdit.updateTask()` exists in [report-runtime.js](../../../skills/html-report/assets/report-runtime.js) and [page-edit-queue/spec.md](../../specs/page-edit-queue/spec.md) states users can edit tasks, `#edit-queue-list` rows only expose `Done`, `Priority`, `↑`, `↓`, and `🗑`. Once a task is queued, users cannot click it to revise its title, description, priority, or `Target Element` back in the **Compose** pane—they must delete and recreate it.
2. **No Document Default Styling & Style Editor Inside Edit Mode:** Users reviewing a report in Edit Mode lack an immediate **Styling** control opposite the `Compose` / `Queue` switcher to (a) set the **document's default theme** (persisting to `report.manifest.json` and rebuilding `index.html` when served, rather than only saving a browser-local preference) and (b) customize brand colors and geometry in a live **OKLCH Style Editor** directly inside the dock without leaving the report.

## What Changes

1. **Queue-to-Compose Task Re-Editing (`template-shell.html`, `report-runtime.js`)**
   - Add an explicit **Edit (`✎`)** action button on every task row in `#edit-queue-list`, and allow clicking the task row/title to load that task into the **Compose** pane (`loadTaskIntoCompose(id)`), while keeping section anchor navigation accessible via a clickable anchor badge/jump control on the row.
   - Populate `#edit-task-title`, `#edit-task-content` (auto-resized), `#edit-task-priority`, `#edit-selected-target` (`Target Element`), and `#edit-task-anchor` from the selected task, and switch the Compose action bar into **Edit Mode** (`Save` + `Cancel` buttons, preserving `id`, `order`, `done`, and `anchor` on save, and invalidating `_generatedPrompt`).
   - Reset editing state cleanly when the user clicks `Cancel`, clicks `+ Task` in the dock bar, or deletes the task currently being edited.

2. **Styling Button, Reset Everything Button & Document Style Editor Pane (`template-shell.html`, `report-runtime.js`, `serve-report.mjs`)**
   - Arrange the `#edit-dock-body` top bar with `[Compose | Queue]` on the left and a dedicated **Styling** toggle button (`#edit-tab-styling`) alongside a **Reset** button (`#edit-dock-reset-btn`) on the opposite (right) side.
   - Clicking **Reset** resets everything in Edit Mode for the page (after confirmation): clears all queued tasks, active Compose form / target selection / edit session, auto-priority & generated prompt state, and resets browser/document custom style & theme overrides back to baseline (`light`, `customTheme: null`).
   - Add `#edit-pane-styling` inside `#edit-dock-body` containing:
     - **Document Default Theme Controls:** Displays the current document default theme vs. active preview theme, lets the user pick from all 32 DaisyUI themes plus custom themes, and provides a **"Set as Default"** button.
     - **Live OKLCH Style Editor:** Compact interactive palette & geometry editor (theme name, optional base theme inheritance `extends`, color pickers + hex inputs for `primary`, `secondary`, `accent`, `neutral`, `base-100`, plus `--rounded-box` / `--rounded-btn` controls). Uses the runtime's existing `compileTheme()`, `registerCustomTheme()`, and `setReportTheme()` to re-theme the DOM, Chart.js charts, and Mermaid diagrams live without reload, saves to `localStorage` (`html_report_custom_themes`), exports CSS, and can apply/set the custom theme as the document default.
   - **Server-Connected Document Default Persistence (`POST /__agent_style__`):** In [serve-report.mjs](../../../skills/html-report/scripts/serve-report.mjs), add a localhost/CSRF-protected endpoint that updates `report.manifest.json` (`theme`, `customTheme`) and triggers `rebuildProjectFromFragment()` for project reports—or safely updates `<html data-theme="...">`, `<style id="daisyui-custom-themes">`, and `#agent-manifest` for standalone workspace `.html` reports—with graceful offline/static fallback when no dev server is running.

## Capabilities

### New Capabilities
<!-- None: both task re-editing in the Compose/Queue dock and document styling inside Edit Mode extend the `page-edit-queue` capability while reusing `custom-daisyui-themes` primitives. -->

### Modified Capabilities
- `page-edit-queue`: Add interactive Queue-to-Compose task re-editing (click/edit trigger, Compose edit/save/cancel lifecycle), add the **Styling** button and **Reset** button opposite the `Compose | Queue` switcher, support setting and resetting the document's default theme (with server persistence and static fallback), and expose an integrated live OKLCH Style Editor pane inside `#edit-dock`.

## Impact

- **Shell & Runtime Assets:**
  - [skills/html-report/assets/template-shell.html](../../../skills/html-report/assets/template-shell.html) (`#edit-dock-body` header row, Compose `Cancel` button, `#edit-tab-styling`, `#edit-pane-styling`)
  - [skills/html-report/assets/report-runtime.js](../../../skills/html-report/assets/report-runtime.js) (`HTMLReportEdit` edit-in-compose state, queue row edit/anchor triggers, styling pane controller, server sync + offline fallback)
- **Local Dev Server & Assembly:**
  - [skills/html-report/scripts/serve-report.mjs](../../../skills/html-report/scripts/serve-report.mjs) (`POST /__agent_style__` endpoint using `enforceLocalBridgeSecurity` + `resolveEditTarget` + `compileTheme`/`buildReport` persistence)
  - [skills/html-report/scripts/build-report.mjs](../../../skills/html-report/scripts/build-report.mjs) (verify `customThemeCss` / `customTheme` preservation on rebuild)
- **Published Document Pruning:** `#edit-pane-styling` and `#edit-tab-styling` reside inside `<!-- html-report:authoring:start edit-dock --> ... <!-- html-report:authoring:end edit-dock -->`, so `--published` automatically prunes all new controls.
- **Tests & Docs:**
  - [tests/settings-authoring.test.mjs](../../../tests/settings-authoring.test.mjs) (unit + DOM tests for Queue-to-Compose re-editing, Styling button layout, Style Editor OKLCH compilation, and `POST /__agent_style__` persistence)
  - [skills/html-report/references/two-way-agent-bridge.md](../../../skills/html-report/references/two-way-agent-bridge.md)
