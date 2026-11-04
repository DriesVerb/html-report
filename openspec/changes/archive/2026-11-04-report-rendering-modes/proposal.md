# Proposal: Distinguishable Report Rendering Modes & Server Orchestration

## Why
Currently, `html-report` supports features like Datastar SSE, Impress.js presentations, and `@media print` queries, but treats rendering modes via loose heuristics (`printable ? "static" : "interactive"`) without a unified, first-class mode architecture.

Users and automated agents need distinct, predictable modes when generating, viewing, and serving reports:
1. **Server Overkill for Static Outputs**: Generating a printable PDF summary (`print`) or a standard reading report (`report`) should be lightweight and zero-overhead without spawning background web servers or persistent ports.
2. **Mandatory Dev Server for Interactive Workflows**: Dynamic dashboards (`dashboard`), real-time hypermedia streams (`live-report`), and in-progress journey companions (`working-report`) require an active HTTP/SSE server with file watching, live reload, and OpenSpec artifact resolution. Spawning them as naked `file://` documents breaks SSE streaming, CORS fetch, and markdown viewers.
3. **Inconsistent Developer Experience**: Users need clear CLI flags (`--mode <mode>` alongside intuitive aliases `--print`, `--presentation`, `--dashboard`, `--live`, `--working`), explicit `data-report-mode` DOM contracts, and mode-tailored navbar badges and download behaviors that strictly match repository design patterns.

## What Changes
1. **First-Class Rendering Modes Architecture**:
   Introduce 6 formalized, distinguishable rendering modes:
   - `print`: Static printable publication / PDF export. Emits `@media print` rules, Page 1 Cover + TOC, static print fallbacks. **Zero server overhead (no live server)**.
   - `report`: Standard standalone analytical reading document. High-contrast cards, responsive layout, TOC dropdown, theme switcher, zero-JS visual scorecards. **Zero server overhead (no live server)**.
   - `presentation`: Interactive slide deck powered by Impress.js. Activates 3D canvas transitions, keyboard navigation (Space/Arrows), presenter progress bar, and slide overview. **Zero persistent server by default; opens standalone or preview**.
   - `dashboard`: Rich KPI & analytical dashboard with multi-metric grids, Chart.js visualizations, filtering, and tabbed widgets. **Server-first: launches local HTTP dev server (`serve-report.mjs`)**.
   - `working-report`: Feature companion & living journey dashboard (OpenSpec stepper, live task checklist, Showdown in-browser markdown viewer for `proposal.md`, `design.md`, `tasks.md`, `specs/`). **Server-first: launches local dev server (`http://localhost:3000`) with live reload and artifact routing**.
   - `live-report`: Real-time hypermedia streaming dashboard powered by Datastar.js and SSE (`/__datastar_stream__`). Streams live agent thoughts, tool execution cards, and reactive signal sync. **Server-mandatory: requires active HTTP/SSE server**.

2. **Builder & CLI Harmonization (`build-report.mjs`)**:
   - Add explicit `--mode <mode>` argument and mode aliases (`--print`/`-p`, `--presentation`, `--dashboard`, `--working`, `--live`/`-l`).
   - Stamp `data-report-mode="<mode>"` on `<html>`.
   - Tailor navbar controls, mode badges, and download options based on active mode (e.g., download as PDF highlights readiness in `print` mode; live indicator pulses in `live-report` and `working-report`).

3. **Harness & Dev Server Orchestration (`harness.mjs` & `serve-report.mjs`)**:
   - Update FSM harness execution flow: inspect active mode to deterministically decide whether to launch `serve-report.mjs` or exit after output compilation and verification.
   - For `dashboard`, `working-report`, and `live-report`: ensure local dev server is launched and auto-opened in a single browser tab.
   - For `print` and `report`: skip server creation entirely; open static HTML file directly or export PDF.
   - Dev server auto-detects `data-report-mode` from the served HTML file to enable appropriate SSE streaming and markdown routing hooks.

4. **Verification & Test Coverage (`verify-report.mjs`)**:
   - Enhance Playwright test harness with mode-specific assertion checks (`--mode <mode>`).

## Capabilities

### New Capabilities
- `report-rendering-modes`: Defines the specification for the 6 distinguishable rendering modes (`print`, `report`, `presentation`, `dashboard`, `working-report`, `live-report`), mode-specific DOM contracts, server orchestration rules, and navbar adaptations.

### Modified Capabilities
- `report-generation-core`: Refines Requirement 11 ("Interactive vs. Static Report Mode Discrimination") into the expanded 6-mode system and links mode definitions to builder and harness pipelines.
- `deterministic-assembly`: Updates assembly contract in `build-report.mjs` to accept `--mode` and inject mode-specific styles, badges, and CDN dependencies.

## Impact
- **Code**: `skills/html-report/scripts/build-report.mjs`, `skills/html-report/scripts/harness.mjs`, `skills/html-report/scripts/serve-report.mjs`, `skills/html-report/assets/template-shell.html`, `skills/html-report/assets/report-runtime.js`, `skills/html-report/playwright/verify-report.mjs`.
- **Docs**: `skills/html-report/SKILL.md`, `skills/html-report/references/architecture-and-styling.md`.
- **Backward Compatibility**: Fully non-breaking; existing flags (`--printable`, `--live`, `--presentation`) map cleanly as aliases to corresponding modes, and default mode remains standard `report`.
