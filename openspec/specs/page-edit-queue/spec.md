# page-edit-queue Specification

## Purpose
Defines the bottom-docked page-edit prompt editor, queued task CRUD with priority, and AI prompt export workflow.

## Requirements

### Requirement: Bottom-docked editor

The system SHALL satisfy: The editor sits at the bottom edge, stays compact (collapsed 40px, expanded max 38vh), and never covers page content.

#### Scenario: Bottom-docked editor verified

- **WHEN** a user opens a generated report and exercises this behavior
- **THEN** the editor sits at the bottom edge, stays compact (collapsed 40px, expanded max 38vh), and never covers page content.

### Requirement: Task CRUD with priority

The system SHALL satisfy: Users can create tasks with title and content, load any queued task back into the Compose pane to edit and save or cancel changes, delete tasks, mark tasks done, and set/reorder priority.

#### Scenario: Task CRUD with priority verified

- **WHEN** a user opens a generated report and creates, re-edits via Compose, marks done, reorders, or deletes tasks
- **THEN** all changes persist to the page-scoped storage key, preserve unmodified task metadata (`id`, `order`, `done`, `anchor`), and invalidate any previously generated prompt.

### Requirement: Queue tab overview

The system SHALL satisfy: A tab lists all tasks ordered by priority with counts, and supports reprioritizing.

#### Scenario: Queue tab overview verified

- **WHEN** a user opens a generated report and exercises this behavior
- **THEN** a tab lists all tasks ordered by priority with counts, and supports reprioritizing.

### Requirement: Scroll-following context

The system SHALL satisfy: The dock shows the section currently in view, anchors new tasks to it, and provides a dedicated section-anchor jump control on anchored queue items to scroll to the task's anchor without blocking task re-editing.

#### Scenario: Scroll-following context verified

- **WHEN** a user opens a generated report, scrolls across sections, and clicks a queued task's section anchor badge
- **THEN** the dock updates the active section indicator, anchors newly composed tasks to the visible section, and scrolls smoothly to the queued task's anchor when its anchor badge is clicked.

### Requirement: Deterministic prompt

The system SHALL satisfy: Generating a prompt from identical tasks and identical page metadata always yields identical text; done tasks are excluded; order follows priority; and workspace-relative `Semantic Fragment`, `Output Deliverable`, and `report.manifest.json` paths from `#agent-manifest` are included when present.

#### Scenario: Deterministic prompt verified

- **WHEN** a user opens a generated report and exercises this behavior with identical tasks and page metadata
- **THEN** generating a prompt twice yields byte-identical text with done tasks excluded, priority order preserved, and workspace source paths included when available.

### Requirement: Agent hand-off states

The system SHALL satisfy: Connected+AI sends to the agent; AI-capable but disconnected offers the turnkey reconnect; otherwise copy-only.

#### Scenario: Agent hand-off states verified

- **WHEN** a user opens a generated report and exercises this behavior
- **THEN** connected+AI sends to the agent; AI-capable but disconnected offers the turnkey reconnect; otherwise copy-only.

### Requirement: Persistence

The system SHALL satisfy: Tasks survive reloads per page and never leak between pages.

#### Scenario: Persistence verified

- **WHEN** a user opens a generated report and exercises this behavior
- **THEN** tasks survive reloads per page and never leak between pages.

### Requirement: Auto-priority prompt synthesis

The system SHALL satisfy: The queue tab provides an auto-priority toggle switch; when enabled, the generated prompt instructs the AI agent to determine its own execution priority order across the tasks.

#### Scenario: Auto-priority instruction included in prompt

- **WHEN** the auto-priority toggle is active during prompt generation
- **THEN** the generated prompt appends an instruction under Constraints directing the AI agent to determine its own optimal execution priority order.

### Requirement: Stale prompt invalidation and gated copy

The system SHALL satisfy: The copy prompt button is disabled until a prompt has been explicitly generated; any queue modification (adding, editing, reordering, deleting tasks, or toggling auto-priority) resets the generated prompt, hides the preview, and disables the copy button with an explanatory tooltip.

#### Scenario: Copy button disabled on queue change

- **WHEN** tasks enter the queue or existing tasks are modified after prompt generation
- **THEN** the active prompt preview is reset and the copy button is disabled until the user generates a fresh prompt.

### Requirement: Darkmode and narrow-viewport visibility

The system SHALL satisfy: The docked editor maintains high visual contrast in darkmode with top border accents, ring outlines, and upward drop shadows; on narrow viewports, control elements maintain fixed width while task titles and section anchor badges stay readable without disappearing.

#### Scenario: High-contrast docked editor in darkmode and narrow viewports

- **WHEN** a user views the editor in a dark theme or on a small screen
- **THEN** the dock remains distinctly visible from page content and task titles/anchors remain readable.

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

### Requirement: Workspace-Aware Edit Prompt Enrichment

The Edit Mode prompt builder SHALL read `#agent-manifest` alongside `meta[name="html-report-source"]` to include exact workspace-relative `Semantic Fragment` (`files.fragment`), `Output Deliverable` (`files.entry`), `project`, `mode`, `theme`, and `activeAddons` context, and SHALL instruct agents to edit only the `Semantic Fragment` without manual rebuild commands when a live-watched fragment is configured.

#### Scenario: Project report includes fragment path and omits manual rebuild step

- **WHEN** a user generates an edit prompt on a project report whose `#agent-manifest` specifies `files.fragment: "projects/q4-sales/fragment.html"` and `files.entry: "projects/q4-sales/index.html"`
- **THEN** the generated prompt explicitly lists `projects/q4-sales/fragment.html` as the primary edit target and notes that the local dev server auto-rebuilds `projects/q4-sales/index.html` on save.

#### Scenario: Standalone report without fragment falls back cleanly

- **WHEN** a user generates an edit prompt on a standalone HTML report that has no `#agent-manifest` fragment entry
- **THEN** the generated prompt falls back to `meta[name="html-report-source"]` as the edit target without emitting broken or undefined paths.

### Requirement: Multi-Project Edit Scoping and Path Resolution

`POST /__agent_edit__` SHALL resolve the target report path safely within the active workspace root—supporting both the root-served report and workspace project deliverables (such as `/projects/<slug>/index.html`)—while rejecting traversal outside the workspace root, and `rebuildProjectFromFragment()` SHALL preserve the workspace-relative `projects/<slug>/index.html` source path.

#### Scenario: Editing a project served under /projects/<slug>/index.html while studio is root

- **WHEN** `serve-report.mjs` is launched on `create.html` or `implementation-progress.html` and a user sends an edit request from `/projects/q4-sales/index.html`
- **THEN** `POST /__agent_edit__` resolves `projects/q4-sales/index.html` and its sibling `projects/q4-sales/fragment.html` without returning HTTP 403.

#### Scenario: Rejecting path traversal outside workspace root

- **WHEN** `POST /__agent_edit__` receives a `file` parameter pointing outside the workspace root (such as `../../etc/passwd`)
- **THEN** the server rejects the request with HTTP 403.

### Requirement: Deduplicated Fast-Model Inference Dispatch

`POST /__agent_edit__` SHALL dispatch prompts to `AgentInferenceRouter` without duplicating the prompt text across both `systemPrompt` and `prompt`, SHALL pass configured fast-model preferences (`payload.model` or `#agent-manifest` `aiConfig.model`), and SHALL inline pre-sliced `Semantic Fragment` sections for any queued `Target Element` or section anchor.

#### Scenario: Single non-duplicated prompt with pre-sliced target fragment context

- **WHEN** `POST /__agent_edit__` dispatches an edit targeting `#kpi-revenue` in `projects/q4-sales/fragment.html`
- **THEN** `AgentInferenceRouter.dispatch()` receives distinct `systemPrompt` and `prompt` payloads (zero duplicated prompt blocks), includes the matching `<section>` or `#kpi-revenue` slice from `fragment.html`, and forwards the configured model tier.

### Requirement: Surgical Fragment Fast-Patch with Static Validation and CLI Fallback

When editing a project with a sibling `fragment.html` and bounded `Target Element` or section context, `POST /__agent_edit__` SHALL support an in-process surgical patch fast-path that validates the resulting `fragment.html` statically (`lintFragment()` + `buildReport()` in `<100ms`) before writing atomically, and SHALL fall back automatically to full workspace-tool CLI execution if the patch cannot be applied or fails validation.

#### Scenario: Valid surgical patch updates fragment.html without CLI spin-up

- **WHEN** the fast-patch inference response returns a valid search/replace or element replacement patch that passes `lintFragment()` and `buildReport()`
- **THEN** the server writes the updated `fragment.html` directly, triggering the 100 ms in-process rebuild and SSE live-reload without spawning a full multi-turn CLI session.

#### Scenario: Invalid or inapplicable patch falls back to full agent CLI

- **WHEN** the fast-patch response fails to match `fragment.html` or fails `lintFragment()` validation
- **THEN** the server leaves `fragment.html` untouched and falls back to dispatching the scoped prompt to the full agent CLI.

### Requirement: Fragment-Scoped Hot-Swap Preservation

The live-reload client script injected by `serve-report.mjs` SHALL separate `<head>` asset and runtime script signatures from `<main>` widget inline scripts so edits inside `fragment.html` preserve in-place `<main>` Idiomorph hot-swapping whenever `<head>` and runtime chrome are unchanged.

#### Scenario: Editing fragment markup preserves Idiomorph hot-swap

- **WHEN** `fragment.html` is updated without changing `<head>` CDN assets or runtime scripts
- **THEN** the connected browser hot-swaps `<main>` in place via Idiomorph and calls `reinitReportContent()`, preserving theme and scroll position.
