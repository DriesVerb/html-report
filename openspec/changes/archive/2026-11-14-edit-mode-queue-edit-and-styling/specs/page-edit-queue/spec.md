# Spec Delta: page-edit-queue

## MODIFIED Requirements

### Requirement: Task CRUD with priority

The system SHALL satisfy: Users can create tasks with title and content, load any queued task back into the Compose pane to edit and save or cancel changes, delete tasks, mark tasks done, and set/reorder priority.

#### Scenario: Task CRUD with priority verified

- **WHEN** a user opens a generated report and creates, re-edits via Compose, marks done, reorders, or deletes tasks
- **THEN** all changes persist to the page-scoped storage key, preserve unmodified task metadata (`id`, `order`, `done`, `anchor`), and invalidate any previously generated prompt.

### Requirement: Scroll-following context

The system SHALL satisfy: The dock shows the section currently in view, anchors new tasks to it, and provides a dedicated section-anchor jump control on anchored queue items to scroll to the task's anchor without blocking task re-editing.

#### Scenario: Scroll-following context verified

- **WHEN** a user opens a generated report, scrolls across sections, and clicks a queued task's section anchor badge
- **THEN** the dock updates the active section indicator, anchors newly composed tasks to the visible section, and scrolls smoothly to the queued task's anchor when its anchor badge is clicked.

## ADDED Requirements

### Requirement: Queue-to-Compose task re-editing

Each task row in the Queue tab (`#edit-queue-list`) SHALL expose an interactive edit trigger (both an explicit Edit action button and clicking the task row/title outside inline action controls) that switches `#edit-dock` to the `Compose` tab, populates the Compose form with the task's `title`, `content`, `priority`, `target`, and `anchor`, and switches the Compose submit controls into edit mode (`Save` + `Cancel`).

#### Scenario: Clicking a queued task loads it into Compose for editing

- **WHEN** a user opens the Queue tab and clicks a queued task's Edit button (or task body)
- **THEN** the dock switches to the `Compose` tab with `#edit-task-title`, `#edit-task-content`, `#edit-task-priority`, `#edit-selected-target` (if any), and `#edit-task-anchor` populated from that task, and `#edit-add-btn` displays `Save` alongside a visible `#edit-cancel-edit-btn` (`Cancel`).

#### Scenario: Saving edits updates the existing task in place and invalidates stale prompt

- **WHEN** the user modifies fields in Compose while editing an existing task and clicks `Save` (or presses `Ctrl/Cmd+Enter`)
- **THEN** `HTMLReportEdit.updateTask()` updates the existing task in place (preserving its `id`, `order`, `done`, and `anchor`), resets any stale generated prompt, clears the Compose form back to `Add` mode, and returns to the `Queue` tab showing the updated task.

#### Scenario: Cancelling or starting a new task exits edit mode cleanly

- **WHEN** the user clicks `Cancel` in Compose, clicks `+ Task` in the dock bar, or deletes the task currently being edited
- **THEN** the active edit session is cleared, the Compose inputs and target selection reset, and `#edit-add-btn` returns to `Add` mode.

### Requirement: Opposite-side Styling and Reset buttons in Edit Dock header

The `#edit-dock-body` tab bar SHALL place the `Compose` / `Queue` tablist on the left and a right-aligned action group on the opposite side containing the **Styling** button (`#edit-tab-styling`) and a **Reset** button (`#edit-dock-reset-btn`) next to it.

#### Scenario: Styling and Reset buttons appear opposite Compose/Queue

- **WHEN** the user expands `#edit-dock`
- **THEN** `[Compose | Queue]` renders on the left side of the tab bar while `Styling` (`#edit-tab-styling`) and `Reset` (`#edit-dock-reset-btn`) render together on the right side; clicking `Styling` displays `#edit-pane-styling` and hides `#edit-pane-compose` and `#edit-pane-queue`.

### Requirement: Full Edit Mode Reset action

Clicking the **Reset** button (`#edit-dock-reset-btn`) next to the Styling button SHALL (upon user confirmation) reset all Edit Mode state for the current document: clearing the task queue, active Compose inputs, active edit session, selected target element, auto-priority flag, and generated prompt, as well as clearing custom theme overrides and resetting the active/default document style back to baseline (`light`, `customTheme: null`).

#### Scenario: Clicking Reset clears tasks, Compose state, and styling overrides

- **WHEN** a user has queued tasks, an active Compose draft or target selection, and custom styling applied, and clicks `#edit-dock-reset-btn` and confirms
- **THEN** the page's task queue is emptied, Compose inputs/edit state/selection mode/generated prompt are cleared, `localStorage` custom theme overrides are cleared, the Style Editor resets to baseline defaults, the active theme returns to `light` (and `POST /__agent_style__` resets `theme: "light"` / `customTheme: null` when server-connected), and the dock returns to a clean `Compose` state.

### Requirement: Document default style selection and persistence

Inside `#edit-pane-styling`, the user SHALL be able to preview any available theme (all 32 DaisyUI themes plus registered custom themes), view which theme is currently configured as the **Document Default**, and click **"Set as Default"** to persist that theme (and custom theme definition if applicable) as the document's default style.

#### Scenario: Setting document default theme on a server-connected report

- **WHEN** a report is served by `serve-report.mjs` and the user selects a theme (standard or custom) and clicks `Set as Default` in `#edit-pane-styling`
- **THEN** the client sends a CSRF-authenticated `POST /__agent_style__` request, the server updates `report.manifest.json` (`theme` and `customTheme`) and rebuilds `index.html` (or updates `<html data-theme>` and `<style id="daisyui-custom-themes">` for standalone workspace files), and subsequent reloads in a clean browser default to the saved theme.

#### Scenario: Graceful fallback when setting default style offline without a dev server

- **WHEN** the report is opened statically (`file://` or without `serve-report.mjs`) and the user clicks `Set as Default`
- **THEN** the runtime applies the theme live, persists it in `localStorage` (`html_report_active_theme` and `html_report_custom_themes`), and displays clear status guidance (including CSS export / HTML snapshot download or agent-prompt fallback) without throwing network errors.

### Requirement: Integrated OKLCH Style Editor in Edit Mode

`#edit-pane-styling` SHALL provide an interactive **Style Editor** backed by the runtime's zero-dependency OKLCH theme compiler (`compileTheme()`, `registerCustomTheme()`, `setReportTheme()`), enabling live editing of theme name, optional base theme inheritance (`extends`), semantic color tokens (`primary`, `secondary`, `accent`, `neutral`, `base-100`), and component geometry (`--rounded-box`, `--rounded-btn`).

#### Scenario: Live OKLCH style editing updates DOM, Chart.js, and Mermaid without reload

- **WHEN** the user adjusts colors or border radius in the Style Editor inside `#edit-pane-styling`
- **THEN** the runtime compiles the theme to OKLCH CSS variables into `<style id="daisyui-custom-themes">`, applies `data-theme` live to the document, refreshes Chart.js palettes and Mermaid diagrams without reloading, and allows saving to `localStorage`, copying the `[data-theme="..."]` CSS snippet, or setting the custom style as the Document Default.
