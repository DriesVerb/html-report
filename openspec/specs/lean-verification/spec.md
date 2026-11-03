# lean-verification Specification

## Purpose
Provides fast, resilient verification of assembled HTML reports across active features and responsive breakpoints without unnecessary PDF rendering overhead.

## Requirements

### Requirement: Lean Responsive Verification
The Playwright verifier SHALL validate report health and responsive layout without requiring all 11 catalog CDNs.

#### Scenario: Fast verification pass
- **GIVEN** an assembled HTML report using only Core 4 CDNs plus Chart.js
- **WHEN** `node skills/html-report/playwright/verify-report.mjs report.html --quick` is executed
- **THEN** the verifier checks responsive layout at `sm` and `lg` breakpoints and exits successfully in under 5 seconds with zero console errors.

### Requirement: On-Demand Single PDF Export
The verifier SHALL export a PDF document only when printable mode or an explicit PDF destination is requested.

#### Scenario: Web-first report skips PDF generation
- **WHEN** verify-report is executed without the `--pdf` flag
- **THEN** no PDF files are generated or written to disk.

#### Scenario: Explicit PDF export produces single target file
- **WHEN** verify-report is executed with `--pdf output.pdf`
- **THEN** exactly one PDF file is generated at `output.pdf` preserving the active DaisyUI theme.
