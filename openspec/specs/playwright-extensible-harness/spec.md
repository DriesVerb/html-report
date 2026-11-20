# playwright-extensible-harness Specification

## Purpose

Provides a modular, pluggable Playwright verification harness with suite/check filtering, precision execution flags, viewport/theme targeting, and machine-readable reporting with visual screenshot capture.

## Requirements

### Requirement: Modular Pluggable Check Architecture
The Playwright verification suite MUST decouple individual test assertions into modular check modules managed by a central registry.

#### Scenario: Running default checks
- **WHEN** `verify-report.mjs` is executed on an HTML report
- **THEN** it executes all enabled checks sequentially through the unified runner pipeline.

#### Scenario: Registering a custom check
- **WHEN** an external script or caller registers a custom check via `registerCheck(name, handler)`
- **THEN** the runner executes the custom check in sequence and includes its results in the final report.

---

### Requirement: Suite and Check Filtering
The verification runner MUST support selective execution of checks via CLI flags.

#### Scenario: Filtering by suite name
- **WHEN** executed with `--suites responsive,themes` or `--only addons`
- **THEN** the runner executes only the specified checks, skipping all others.

#### Scenario: Filtering by pattern
- **WHEN** executed with `--grep "<pattern>"`
- **THEN** only checks whose name or description matches the regular expression are executed.

---

### Requirement: Precision Environment and Timing Flags
The runner MUST support configurable execution timings and abort behaviors.

#### Scenario: Custom navigation and assertion timeout
- **WHEN** executed with `--timeout 10000`
- **THEN** page navigation and function wait timeouts are bounded to 10,000 milliseconds.

#### Scenario: Fast fail on regression
- **WHEN** executed with `--bail`
- **THEN** the runner halts test execution immediately upon encountering the first failure and exits with code 1.

#### Scenario: Strict warning enforcement
- **WHEN** executed with `--strict`
- **THEN** console warnings or horizontal layout alerts (`data-insufficient-space="true"`) are treated as test failures.

---

### Requirement: Target Viewports and Theme Filtering
The runner MUST allow explicit specification of viewport dimensions and DaisyUI themes to test.

#### Scenario: Custom viewport verification
- **WHEN** executed with `--viewports sm,lg` or `--viewports 1920x1080`
- **THEN** only the specified viewports are resized and evaluated.

#### Scenario: Selective theme verification
- **WHEN** executed with `--themes light,dark,cyberpunk`
- **THEN** the theme switching check tests only the named themes rather than cycling through all 32 themes.

---

### Requirement: Machine-Readable Reporting and Screenshot Capture
The runner MUST support saving structured diagnostic data and visual artifacts, capturing both `review_desktop` (`1280x900`) and `review_mobile` (`640x800`) screenshots during `--review-packet`, and SHALL NOT treat `cdnCache=true` as a targeted check filter.

#### Scenario: JSON test output
- **WHEN** executed with `--json <path-to-results.json>`
- **THEN** the runner writes an execution report containing total tests, passed, failed, duration, and error traces.

#### Scenario: Failure screenshots
- **WHEN** executed with `--screenshots [dir]`
- **THEN** the runner saves PNG screenshots of the page state upon any failed assertion or for each tested viewport.

#### Scenario: Standard run with cdnCache=true and --review-packet captures desktop and mobile views
- **WHEN** `verify-report.mjs` runs without `--check-*` filtering and with `--review-packet --screenshots <dir>`
- **THEN** the runner executes in `STANDARD` mode (not `TARGETED`) despite `cdnCache: true` and saves both `review_desktop` and `review_mobile` PNG screenshots.
