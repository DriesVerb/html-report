# Delta Specification: playwright-extensible-harness

## MODIFIED Requirements

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
