# studio-fast-assembly Specification

## Purpose
Defines one-click project scaffolding, `fragment.html` auto-rebuild, layout widget presets, CSV/JSON data-bound starter generation, fast static verification, and direct bridge dispatch for `html-report`.

## Requirements

### Requirement: One-Click Studio Scaffolding with Optional Folder Slug
The Creation Studio (`create.html`) and local server (`serve-report.mjs`) MUST place **"Project folder name"** (`#input-project-slug`) and the **"Create Workspace"** button (`#btn-scaffold-now`) together in a dedicated Workspace Setup section (`#workspace-setup-section`) positioned between **"What are you building? (Deliverable Purpose)"** and **"Describe what you want to build"**, allowing users to scaffold `projects/<slug>/` immediately after choosing a deliverable type and synchronize subsequent Steps 2–5 configuration changes in-place.

#### Scenario: Workspace section placement and side-by-side folder + Create Workspace controls
- **GIVEN** the user opens Creation Studio (`create.html` or `/create`)
- **WHEN** the Step 1 questionnaire renders
- **THEN** `#workspace-setup-section` appears in DOM and visual order after the 4 deliverable target cards (`"What are you building?"`) and before `"Describe what you want to build"`
- **AND** `#input-project-slug` (`"Project folder name"`) and `#btn-scaffold-now` (`"Create Workspace"`) sit side-by-side inside `#workspace-setup-section`.

#### Scenario: Early workspace creation and in-place config sync
- **GIVEN** a user enters `q4-sales-audit` in `#input-project-slug` and clicks **"Create Workspace"** (`POST /api/create/scaffold`)
- **WHEN** `scaffoldProject()` creates `projects/q4-sales-audit/` with `fragment.html`, `index.html`, `report.manifest.json`, `AGENTS.md`, and `refs/`
- **THEN** the studio records `activeWorkspaceSlug = "q4-sales-audit"` and updates `#workspace-lifecycle-status` to `Workspace Created`
- **AND** when the user subsequently edits Steps 1–5 (goals, audience, mode, features, theme, AI) and triggers **"Update Workspace"**, `POST /api/create/scaffold` with `updateExisting: true` updates `projects/q4-sales-audit/report.manifest.json` and rebuilds `index.html` without creating a duplicate `q4-sales-audit-2` folder or deleting existing `refs/` files.

#### Scenario: Auto-generating slug and avoiding silent collision on fresh create
- **GIVEN** `#input-project-slug` is left blank and `projects/my-report/` already exists
- **WHEN** `POST /api/create/scaffold` is called without `updateExisting: true` or `force: true`
- **THEN** the server derives the slug from goals/title/target and auto-increments (`my-report-2`) without overwriting the existing project.

### Requirement: Workspace-Scoped Reference Staging & Existing-File Inclusion
In Creation Studio (`"Does it need to be built on the basis of other documents, images, or data-sets?"`), uploaded reference files MUST be saved directly inside the active project workspace (`projects/<slug>/refs/`) rather than a generic `projects/_uploads/` folder, and files already present inside `projects/<slug>/` MUST be surfaced and included in the reference list and workspace picker.

#### Scenario: Uploading a reference file when a project workspace is active
- **GIVEN** an active project workspace `q4-sales-audit` (`projects/q4-sales-audit/` created via `#btn-scaffold-now` or specified in `#input-project-slug`)
- **WHEN** the user drops or selects `revenue.csv` in `"Does it need to be built on the basis of other documents, images, or data-sets?"`
- **THEN** `create.html` sends `projectSlug: "q4-sales-audit"` to `POST /api/create/upload`
- **AND** `serve-report.mjs` writes the sanitized file to `projects/q4-sales-audit/refs/revenue.csv` (not `projects/_uploads/`)
- **AND** `#collected-files-list` and `#prompt-output-box` reference `projects/q4-sales-audit/refs/revenue.csv`.

#### Scenario: Auto-including files already present in the project workspace
- **GIVEN** `projects/q4-sales-audit/refs/existing-notes.md` (or another data/document file inside `projects/q4-sales-audit/`) already exists on disk
- **WHEN** the workspace `q4-sales-audit` is created/loaded or `GET /api/create/workspace-files?project=q4-sales-audit` is queried
- **THEN** `serve-report.mjs` returns `existing-notes.md` under `projectFiles` (prioritized ahead of general repo files and excluding generated boilerplate `index.html`, `fragment.html`, `report.manifest.json`, `AGENTS.md`)
- **AND** `create.html` automatically includes `projects/q4-sales-audit/refs/existing-notes.md` in `#collected-files-list` and `#prompt-output-box` under `"Does it need to be built on the basis of..."`.

#### Scenario: Rejecting path traversal on workspace-scoped upload
- **GIVEN** a `POST /api/create/upload` request with `projectSlug: "q4-sales-audit"` and `name: "../../etc/passwd"`
- **WHEN** `serve-report.mjs` resolves the destination path
- **THEN** the server strips directory components to `passwd` and confines the write strictly inside `projects/q4-sales-audit/refs/`, rejecting any escape outside `refs/` with HTTP `403`.

### Requirement: Automatic Fragment-to-Index Rebuild on Save
When `serve-report.mjs` serves a project `index.html` that has a sibling `fragment.html` and `report.manifest.json`, saving `fragment.html` MUST automatically rebuild `index.html` in-process and trigger live reload.

#### Scenario: Saving fragment.html triggers sub-second rebuild and SSE reload
- **GIVEN** `serve-report.mjs` is serving `projects/q4-sales-audit/index.html`
- **WHEN** `projects/q4-sales-audit/fragment.html` is modified on disk
- **THEN** `serve-report.mjs` invokes `buildReport()` using `report.manifest.json` settings
- **AND** writes the updated `projects/q4-sales-audit/index.html` and broadcasts a live-reload event.

### Requirement: Canonical Widget Presets and Data-Bound Starters
`domain-model.mjs` and `scaffold-project.mjs` MUST support canonical `--widgets` presets and automatic CSV/JSON schema introspection for starter widgets.

#### Scenario: Scaffolding with CSV reference and widget presets
- **GIVEN** `scaffoldProject()` is invoked with `widgets: ["kpi-row", "chart-pair", "grid-table"]` and a CSV reference file with headers `region,arr`
- **WHEN** `generateStarterFragment()` runs
- **THEN** `fragment.html` includes valid DaisyUI v4 KPI/chart/table markup pre-bound to `region` and `arr`.

### Requirement: Two-Speed Verification Gate
`harness.mjs` MUST provide a `--fast` static verification mode for rapid fragment iterations without launching Playwright.

#### Scenario: Running fast static lint gate
- **GIVEN** a modified `projects/q4-sales-audit/fragment.html`
- **WHEN** `node skills/html-report/scripts/harness.mjs projects/q4-sales-audit/fragment.html --fast` is executed
- **THEN** `lintFragment()` and `buildReport()` validate the fragment in `<100ms` without launching headless Chromium.

### Requirement: Domain Model Unification and Secure Two-Way Bridge Dispatch
`create.html` MUST stay aligned with `domain-model.mjs` canonical theme names (`lemonade`) and MUST hide `#btn-send-to-agent` (**"Send to Agent"**) unless `/api/agent/preflight` verifies a secure, authenticated two-way bridge (`secureBridge: true`, authenticated/verified provider, loopback host, valid local origin, and ephemeral CSRF token from `/api/agent/csrf-token`).

#### Scenario: Hiding Send to Agent when bridge is offline or unauthenticated
- **GIVEN** `/api/agent/preflight` is unreachable, reports `secureBridge: false`, or reports an unauthenticated provider (`authenticated: false` and `inferenceVerified: false`)
- **WHEN** `create.html` runs `checkAgentBridgePreflight()`
- **THEN** `#btn-send-to-agent` remains hidden (`hidden`) and disabled.

#### Scenario: Dispatching prompt directly to a verified secure two-way bridge
- **GIVEN** `/api/agent/preflight` reports `secureBridge: true` with an authenticated/verified provider and an ephemeral CSRF token
- **WHEN** the user clicks **"Send to Agent"** in `create.html`
- **THEN** the studio `POST`s the synthesized prompt, project metadata, and `X-CSRF-Token` header to `/api/agent/prompt`, which enforces loopback, Host, local Origin, and CSRF token validation.
