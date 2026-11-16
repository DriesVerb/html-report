# Spec Delta: page-edit-queue

## MODIFIED Requirements

### Requirement: Deterministic prompt

The system SHALL satisfy: Generating a prompt from identical tasks and identical page metadata always yields identical text; done tasks are excluded; order follows priority; and workspace-relative `Semantic Fragment`, `Output Deliverable`, and `report.manifest.json` paths from `#agent-manifest` are included when present.

#### Scenario: Deterministic prompt verified

- **WHEN** a user opens a generated report and exercises this behavior with identical tasks and page metadata
- **THEN** generating a prompt twice yields byte-identical text with done tasks excluded, priority order preserved, and workspace source paths included when available.

## ADDED Requirements

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
