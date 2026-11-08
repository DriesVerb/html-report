# Proposal: Edit Mode Element Selection

## Why

When editing a report, referencing a specific heading, chart, table, or KPI card requires manually inspecting HTML or typing complex descriptions. Adding an interactive "Select mode" next to "+ Task" allows readers to visually click any element to anchor their edit request to an exact `#id` with zero layout shift and no external dependencies.

## What Changes

- Add a **[⌖ Select]** toggle button in the authoring edit dock (`#edit-dock-bar`) directly adjacent to the `+ Task` button.
- Implement an **isolated Selection Mode**:
  - When active, the body switches cursor to `crosshair` and intercepts click events across the report.
  - Hovering elements triggers a zero-reflow, GPU-accelerated color inversion (`filter: invert(1) hue-rotate(180deg)`), active strictly in selection mode and never in normal browsing.
  - The `#edit-dock` itself, modals, and settings menus are excluded from selection to allow docking controls.
  - Pressing `Escape` or toggling the button immediately cancels selection mode.
- Implement **Just-in-Time Semantic ID Assignment**:
  - If a clicked element has an existing `id`, it is used directly.
  - If it lacks an `id`, runtime generates a clean, unique, semantic slug (e.g., `h2-revenue-trends` or `canvas-chart-1`) and sets `el.id`.
- Implement **Compose Menu Target Badge (No Autofill)**:
  - Clicking an element exits selection mode and opens the Compose pane.
  - Displays a dedicated, dismissible selection chip (e.g., `Target: #id-xyz (tag) [✕]`).
  - Inputs (title and content) remain completely unpolluted with no automatic text insertion, giving users full freedom to write their prompt.
- Integrate Selected Target in **Deterministic Prompt Generation**:
  - `HTMLReportEdit.buildEditPrompt()` includes `Target Element: #id (tag)` and anchors so downstream AI agents or developers receive precise, reproducible targets for code edits.

## Capabilities

### New Capabilities
- `page-edit-selection`: Interactive DOM element selection mode in the authoring edit dock, featuring zero-reflow invert hover highlights, just-in-time semantic ID stamping, compose drawer target chips without autofill, and target element formatting in deterministic edit prompts.

### Modified Capabilities
*(None)*

## Impact
- **Runtime Assets**: Modifies `skills/html-report/assets/report-runtime.js` and `skills/html-report/assets/template-shell.html`.
- **Runtime Dependencies**: Zero `node_modules`. Pure static vanilla JavaScript utilizing standard DOM APIs (`pointerover`/`pointerout`, capture-phase click interception, GPU filter CSS).
- **Backwards Compatibility**: Fully backwards compatible with existing edit queues and themes.
