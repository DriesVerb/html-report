# studio-fast-assembly Specification

## Purpose
Defines one-click project scaffolding, `fragment.html` auto-rebuild, layout widget presets, CSV/JSON data-bound starter generation, fast static verification, and direct bridge dispatch for `html-report`.

## Requirements

### Requirement: One-Click Studio Scaffolding with Optional Folder Slug
The Creation Studio (`create.html`) and local server (`serve-report.mjs`) MUST allow users to scaffold a project immediately without waiting for an AI agent, using an optional user-specified folder slug independent of the AI display title.

#### Scenario: Scaffolding with a custom folder slug and staged reference files
- **GIVEN** a user enters `q4-sales-audit` in `#input-project-slug` and has staged `projects/_uploads/sales.csv`
- **WHEN** the user clicks **"Scaffold Now"** (`POST /api/create/scaffold`)
- **THEN** `scaffoldProject()` creates `projects/q4-sales-audit/` with `fragment.html`, `index.html`, `report.manifest.json`, and `AGENTS.md`
- **AND** copies `projects/_uploads/sales.csv` into `projects/q4-sales-audit/refs/sales.csv`
- **AND** returns `{ ok: true, slug: "q4-sales-audit", entryUrl: "/projects/q4-sales-audit/index.html" }`.

#### Scenario: Auto-generating slug and avoiding silent collision
- **GIVEN** `#input-project-slug` is left blank and `projects/my-report/` already exists
- **WHEN** `POST /api/create/scaffold` is called without `force: true`
- **THEN** the server derives the slug from goals/title and auto-increments (`my-report-2`) without overwriting the existing project.

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
