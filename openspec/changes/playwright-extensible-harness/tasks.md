# Tasks: Playwright Extensible Verification Harness & Precision Flags

## Phase 1: Architecture Core & Check Registry
- [ ] 1.1 Create `skills/html-report/playwright/harness/registry.mjs` defining the `VerificationCheck` contract and `CheckRegistry` registration API.
- [ ] 1.2 Create `skills/html-report/playwright/harness/runner.mjs` orchestrating browser startup, context creation, check pipeline execution, and timeout handling.
- [ ] 1.3 Create `skills/html-report/playwright/harness/reporter.mjs` managing console status logging, execution timers, and formatted summaries.

## Phase 2: Check Modules Extraction
- [ ] 2.1 Extract console error and network tile monitoring into `harness/checks/console-errors.mjs`.
- [ ] 2.2 Extract dynamic CDN addon verification into `harness/checks/addons-health.mjs` (supporting all core and newly expanded CDNs).
- [ ] 2.3 Extract responsive viewport testing and horizontal overflow detection into `harness/checks/responsive.mjs`.
- [ ] 2.4 Extract DaisyUI theme switching and palette verification into `harness/checks/theme-switcher.mjs`.
- [ ] 2.5 Extract print media styling and PDF generation into `harness/checks/print-pdf.mjs`.
- [ ] 2.6 Implement WCAG AA color contrast check in `harness/checks/a11y-contrast.mjs`.

## Phase 3: Precision CLI Flags Implementation
- [ ] 3.1 Implement `--timeout <ms>` flag for configurable navigation and assertion timeout bounds.
- [ ] 3.2 Implement `--suites <names>` and `--only <name>` filtering to selectively run check subsets.
- [ ] 3.3 Implement `--grep <pattern>` filtering to execute checks or assertions matching regex patterns.
- [ ] 3.4 Implement `--themes <list>` to test specific DaisyUI themes instead of cycling through all themes.
- [ ] 3.5 Implement `--viewports <list>` supporting named breakpoints (`sm`, `md`, `lg`, `xl`, `2xl`) and custom dimensions (`WxH`).
- [ ] 3.6 Implement `--bail` for immediate execution halt upon first failed assertion.
- [ ] 3.7 Implement `--strict` flag treating layout warnings and console warnings as hard errors.
- [ ] 3.8 Implement `--headed` flag to enable non-headless browser debugging.

## Phase 4: Diagnostics, JSON Reporting & Screenshots
- [ ] 4.1 Implement `--json <path>` to export structured machine-readable test execution reports.
- [ ] 4.2 Implement `--screenshots [dir]` capturing PNG images of failed assertions and responsive viewports.
- [ ] 4.3 Ensure legacy CLI invocations (`--quick`, `--pdf`, `--mode`, `--caller`) function with 100% backward compatibility via `verify-report.mjs`.

## Phase 5: Verification & Documentation
- [ ] 5.1 Add automated test script in `tests/` verifying all new CLI flags against test reports.
- [ ] 5.2 Verify runner performance: ensure `--quick` executes within target latency bounds.
- [ ] 5.3 Update `skills/html-report/SKILL.md` with Playwright flags documentation and troubleshooting guide.
- [ ] 5.4 Update companion `index.html` report and sync with `localhost:3000`.
