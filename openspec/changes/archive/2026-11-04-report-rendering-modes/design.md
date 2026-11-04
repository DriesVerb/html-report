# Design: Distinguishable Report Rendering Modes & Server Orchestration

## Context
The `html-report` repository provides a non-blocking 17-library CDN stack, deterministic builder (`build-report.mjs`), FSM harness (`harness.mjs`), and dev server (`serve-report.mjs`). Previously, execution modes were loosely determined by discrete flags (`printable`, `live`, `presentation`) or ad-hoc boolean checks, leading to confusion about when a local dev server should run and whether interactive features (SSE streaming, markdown artifact resolution) would function properly.

## Goals / Non-Goals

**Goals:**
- Define a canonical enum of 6 distinguishable modes: `print`, `report`, `presentation`, `dashboard`, `working-report`, and `live-report`.
- Enforce the server orchestration rule:
  - `print` and `report`: strictly **zero server overhead** (no server launched).
  - `presentation`: standalone file / preview.
  - `dashboard`, `working-report`, and `live-report`: **server required/mandatory** (`serve-report.mjs` on port 3000).
- Expose clear CLI flags (`--mode <mode>` alongside intuitive aliases `--print`, `--presentation`, `--dashboard`, `--working`, `--live`).
- Stamp `data-report-mode="<mode>"` on the root `<html>` element in `build-report.mjs`.
- Provide mode-aware navbar badges and adaptive download buttons.
- Enable `serve-report.mjs` to auto-detect the document mode and enable SSE streaming / markdown routing when appropriate.
- Ensure Datastar.js is automatically bundled for `live-report` (where SSE hypermedia streaming is the core feature) while remaining on-demand for other server modes (`dashboard`, `working-report`).

**Non-Goals:**
- Modifying underlying CDN libraries or introducing external server dependencies outside Node.js built-ins.
- Forcing Datastar into every server version when not needed.

## Decisions

### 1. Canonical Mode Enum & Alias Normalization
- **Decision**: Define a single canonical array of modes: `["print", "report", "presentation", "dashboard", "working-report", "live-report"]`. Normalize existing flags (`--printable` / `-p`, `--live` / `-l`, `--presentation`, `--working`, `--dashboard`) into their canonical mode during CLI argument parsing.
- **Rationale**: Provides ergonomic developer shortcuts while maintaining an unambiguous, single source of truth for the builder and runtime.
- **Alternatives Considered**:
  - *Keep separate boolean flags*: Rejected; leads to invalid combinatorial states (e.g., `--printable` with `--live`).

### 2. Deterministic Dev Server Orchestration in Harness & CLI Runner
- **Decision**: In `harness.mjs` and `build-report.mjs`, evaluate `MODE_SERVER_POLICIES`:
  ```javascript
  export const MODE_SERVER_POLICIES = {
    print: { requiresServer: false, defaultAction: "export_or_static" },
    report: { requiresServer: false, defaultAction: "open_static" },
    presentation: { requiresServer: false, defaultAction: "open_static" },
    dashboard: { requiresServer: true, defaultAction: "serve" },
    "working-report": { requiresServer: true, defaultAction: "serve" },
    "live-report": { requiresServer: true, defaultAction: "serve" }
  };
  ```
  When `requiresServer: false`, the harness skips starting a background server and outputs the file or triggers Playwright PDF export directly. When `requiresServer: true`, the harness ensures `serve-report.mjs` is launched on the designated port (default 3000) and opens a single tab.
- **Rationale**: Directly satisfies the user requirement that `print` and `report` do not spawn unwanted server processes, while `dashboard`, `working-report`, and `live-report` guarantee active server support.
- **Alternatives Considered**:
  - *Always prompt user before starting server*: Rejected; breaks automated CLI runs and CI pipelines.

### 3. DOM Contract: `data-report-mode` on `<html>`
- **Decision**: Always inject `data-report-mode="<mode>"` onto `<html ...>`.
- **Rationale**: Allows CSS selectors (`[data-report-mode="print"]`), client runtime (`report-runtime.js`), and `serve-report.mjs` to inspect the rendered file and adapt behavior deterministically without guessing.

### 4. Dev Server Inspection & Smart Feature Activation
- **Decision**: When `serve-report.mjs` serves an HTML file, it scans the file's `data-report-mode` attribute. If it detects `working-report`, `live-report`, or `dashboard`, it automatically activates live SSE streaming (`/__datastar_stream__`) and OpenSpec markdown artifact resolution (`/proposal.md`, `/design.md`, etc.).
- **Rationale**: Keeps the server lightweight for arbitrary files while unlocking rich interactive features when serving companion and live reports.

### 5. Datastar Bundle Policy
- **Decision**: Datastar bundle is automatically injected when mode is `live-report` or when Datastar signatures/addons are detected. In `dashboard` and `working-report`, Datastar is supported on-demand rather than mandatorily forced.
- **Rationale**: Keeps payload lean while ensuring `live-report` works out-of-the-box.

## Risks / Trade-offs

- **[Risk] Existing scripts using `--printable` or `--live` might break** → **Mitigation**: Retain `--printable`, `-p`, `--live`, `-l`, and `--presentation` as aliases that map directly to `print`, `live-report`, and `presentation`.
- **[Risk] Dev server already running on port 3000 when a server-required mode runs** → **Mitigation**: Dev server checks if port 3000 is already active and serving; if so, reuses the running server and triggers tab reload rather than failing with EADDRINUSE.

## Migration Plan
1. Update `skills/html-report/scripts/build-report.mjs` to parse `--mode`, validate against the 6 canonical modes, auto-bundle Datastar for `live-report`, and inject `data-report-mode`.
2. Update `skills/html-report/scripts/harness.mjs` to incorporate `MODE_SERVER_POLICIES` and conditionally invoke `serve-report.mjs`.
3. Update `skills/html-report/scripts/serve-report.mjs` to read mode attributes and handle OpenSpec markdown routing and SSE.
4. Update `skills/html-report/assets/template-shell.html` and `skills/html-report/assets/report-runtime.js` to render mode indicator badges in the navbar and adjust download options.
5. Add unit and integration tests verifying CLI parsing, DOM attributes, and server policy decisions.

## Open Questions
- None.
