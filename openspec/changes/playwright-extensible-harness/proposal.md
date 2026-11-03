# Proposal: Playwright Extensible Verification Harness & Precision Flags

## Why
`skills/html-report/playwright/verify-report.mjs` was created as an all-in-one verification script to validate HTML reports across breakpoints, theme switches, and PDF output. However, as the `html-report` project has expanded (adding dynamic caller awareness, custom theme compilers, print covers, and 12+ CDN addons), the monolithic structure faces serious limitations:

1. **Tight Coupling & Monolithic Architecture**: All checks (DOM inspection, console logging, network tile errors, breakpoint resizing, theme switching, PDF export, caller integration) are hardcoded into a single 645-line procedural script. Adding a new check or addon assertion requires modifying the entire verification file.
2. **Limited Invocational Precision**: Currently, the CLI only supports coarse controls (`--quick`, `--mode`, `--pdf`, `--caller`). Authors and automated agent pipelines cannot selectively run just theme tests, adjust timeouts for slow CI runners, filter test steps, or capture debug screenshots on failure.
3. **Missing Machine-Readable Diagnostics**: When tests fail in automated agent workflows, the output is unstructured terminal text, making programmatic diagnosis, auto-remediation, and CI status reporting brittle.
4. **Lack of Accuracy Flags**: Agents need precision controls such as `--strict` (turn warnings into hard errors), `--bail` (fail fast on first regression), `--timeout` (prevent hangs in resource-constrained environments), and `--themes` (test specific palettes without waiting for 32 theme switches).

Refactoring the Playwright verification suite into an **extensible, pluggable check pipeline** with **fine-grained precision flags** provides a modern, robust, and highly extensible testing foundation.

---

## Architectural Decisions
* **D1 (Pluggable Check Pipeline)**: Break verification into isolated, reusable check modules (`CheckConsoleHealth`, `CheckAddonHealth`, `CheckResponsiveLayout`, `CheckThemeIntegrity`, `CheckPrintMedia`, `CheckA11yContrast`). Each check implements a clean contract: `async execute({ page, context, options, reporter })`.
* **D2 (Extensible Check Registry)**: Expose a registry allowing external scripts or callers (e.g. caller harness, benchmark suites, user test scripts) to register custom validation hooks without modifying core code.
* **D3 (Rich Precision CLI Flags)**: Add granular flags:
  - Execution control: `--timeout <ms>`, `--bail`, `--strict`, `--headed`
  - Filtering: `--suites <names>`, `--only <name>`, `--grep <regex>`
  - Visual & environmental targeting: `--themes <list>`, `--viewports <list>`, `--screenshots [dir]`
  - Diagnostics & reporting: `--json <path>`, `--quiet`, `--verbose`
* **D4 (100% Backward Compatibility)**: The existing `node skills/html-report/playwright/verify-report.mjs <file> [--quick] [--pdf <path>] [--mode <mode>] [--caller <caller>]` command signature remains fully supported as a transparent facade delegating to the new pipeline.

---

## What Changes

### 1. Modular Directory Structure
Under `skills/html-report/playwright/`:
* `harness/runner.mjs`: Orchestrates browser launch, context creation, check scheduling, and timing.
* `harness/registry.mjs`: Manages standard checks and dynamically registered custom checks.
* `harness/reporter.mjs`: Handles console formatting, spinners, verbose logs, and structured JSON output.
* `harness/checks/`:
  - `console.mjs`: Monitors console errors, unhandled exceptions, and bad network responses.
  - `addons.mjs`: Dynamically checks active CDN library instances (`window.Chart`, `window.FullCalendar`, etc.).
  - `responsive.mjs`: Tests layout across specified viewports and detects `data-insufficient-space`.
  - `themes.mjs`: Switches themes, tests DaisyUI swatches, and validates Chart/Mermaid color palette sync.
  - `print.mjs`: Verifies `@media print` rules, cover page layout, and PDF generation.
  - `a11y.mjs`: Performs WCAG contrast and accessibility landmark checks.
* `verify-report.mjs`: Light CLI entrypoint parsing arguments and passing them into `runner.mjs`.

### 2. Expanded CLI Flag Matrix
Full documentation and implementation of:
`--timeout`, `--suites`, `--only`, `--grep`, `--themes`, `--viewports`, `--screenshots`, `--bail`, `--strict`, `--json`, `--color-contrast`, and `--headed`.

---

## Capabilities

### New Capabilities
* `playwright-extensible-harness`: Modular check execution, custom check registration, fine-grained test filtering, structured JSON reporting, and precision execution flags for the Playwright verification suite.

---

## Impact
* **Modularity**: New checks (e.g. verifying new CDN libraries or custom themes) can be added as self-contained files without touching the runner.
* **Performance & Speed**: Developers and CI can run targeted checks (e.g. `--suites themes --themes dark,dracula`) in milliseconds rather than running the full 30-second suite.
* **Agent Integration**: Machine-readable JSON output (`--json`) provides LLMs with exact line numbers, failed assertions, and screenshot paths for automated self-healing.
