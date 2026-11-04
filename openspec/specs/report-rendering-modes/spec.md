# report-rendering-modes Specification

## Purpose
Provides a formalized, distinguishable rendering mode architecture for HTML reports, specifying mode-dependent styling contracts, UI affordances, and deterministic dev server orchestration rules.

## Requirements

### Requirement: Canonical Six Distinguishable Rendering Modes
The system SHALL support six canonical rendering modes: `print`, `report`, `presentation`, `dashboard`, `working-report`, and `live-report`, each establishing explicit visual, layout, and runtime contracts.

#### Scenario: Defaulting to standard report mode
- **WHEN** an HTML report is assembled or executed without an explicit mode argument
- **THEN** the system SHALL resolve the mode as `report`.

#### Scenario: Explicit canonical mode selection via CLI
- **WHEN** the user provides `--mode <mode>` (e.g., `--mode dashboard`)
- **THEN** the system SHALL validate the argument against canonical modes and apply that mode.

#### Scenario: Rejecting invalid mode arguments
- **WHEN** an unrecognized mode value is passed (e.g., `--mode invalid-mode`)
- **THEN** the system SHALL reject the argument with a validation error detailing allowable modes.

#### Scenario: Resolving ergonomic CLI mode aliases
- **WHEN** the user provides flag aliases `--print` (or `-p`), `--presentation`, `--dashboard`, `--working` (or `--working-report`), or `--live` (or `-l`)
- **THEN** the system SHALL normalize the flag to its canonical mode name.

#### Scenario: Live-report mode mandates Datastar bundle
- **WHEN** an HTML report is compiled in `live-report` mode
- **THEN** the builder MUST automatically inject the Datastar script tag into `<head>`, while other server modes (`dashboard`, `working-report`) load Datastar on-demand.

### Requirement: Deterministic Dev Server Orchestration Rule
The FSM harness and CLI runner SHALL deterministically govern dev server execution based on the resolved rendering mode: `print` and `report` modes SHALL NOT launch a dev server, whereas `dashboard`, `working-report`, and `live-report` modes SHALL launch and maintain a dev server.

#### Scenario: Executing in print mode
- **WHEN** a report is executed or validated in `print` mode
- **THEN** the runner SHALL NOT spawn a background dev server and SHALL output the static deliverable and optional PDF.

#### Scenario: Executing in standard report mode
- **WHEN** a report is executed in `report` mode
- **THEN** the runner SHALL NOT spawn a background dev server and SHALL deliver a standalone HTML file.

#### Scenario: Executing in dashboard or live report mode
- **WHEN** a report is executed in `dashboard`, `working-report`, or `live-report` mode
- **THEN** the runner SHALL verify or launch `serve-report.mjs` and open the report in a single browser tab.

### Requirement: DOM Contract and Root HTML Mode Stamping
The deterministic report builder SHALL stamp `data-report-mode="<mode>"` on the root `<html>` element of every assembled report.

#### Scenario: Root HTML tag contains mode attribute
- **WHEN** an HTML report is compiled in `working-report` mode
- **THEN** the root `<html>` tag MUST include `data-report-mode="working-report"`.

#### Scenario: Dev server detects mode from HTML file
- **WHEN** `serve-report.mjs` serves a file with `data-report-mode="live-report"` or `data-report-mode="working-report"`
- **THEN** the dev server SHALL activate real-time SSE streaming endpoints and OpenSpec markdown artifact routing.

### Requirement: Mode-Adaptive Navbar and Download Controls
The report runtime and sticky navbar SHALL adapt UI elements, status badges, and download triggers based on the active report mode.

#### Scenario: Download options in print mode
- **WHEN** an HTML report in `print` mode is viewed on screen
- **THEN** the navbar download dropdown SHALL highlight PDF export readiness and print styles SHALL suppress non-printable elements in `@media print`.

#### Scenario: Connection badge in live and working modes
- **WHEN** an HTML report in `live-report` or `working-report` mode is rendered in the browser
- **THEN** the navbar SHALL display an active status indicator badge reflecting live server connectivity.
