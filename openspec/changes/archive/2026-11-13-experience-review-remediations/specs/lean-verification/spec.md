# lean-verification Delta Specification

## ADDED Requirements

### Requirement: Symlink-Safe CLI Direct Execution
All CLI entrypoints (`verify-report.mjs`, `build-report.mjs`, `scaffold-project.mjs`, `serve-report.mjs`, and `preflight.mjs`) SHALL resolve canonical filesystem paths (`fs.realpathSync`) before comparing `process.argv[1]` with `import.meta.url` so invocations through symlinked skill directories always execute and produce output artifacts.

#### Scenario: Verifier invoked through a symlinked skill directory
- **WHEN** `node <symlink-dir>/playwright/verify-report.mjs report.html --quick --json result.json` is executed where `<symlink-dir>` is a symbolic link to `skills/html-report`
- **THEN** the verifier executes all active checks, writes `result.json` to disk, and exits with a status code reflecting verification compliance.

### Requirement: Automatic System Chrome Fallback on Missing Playwright Revision
When Playwright's bundled Chromium binary is missing or fails to launch in `runner.mjs`, the harness SHALL automatically fall back to an installed system Chrome/Chromium binary (`channel: "chrome"` or detected system executable path) before failing verification.

#### Scenario: Bundled Playwright Chromium revision is unavailable
- **WHEN** `runHarness()` attempts to launch Chromium and the default Playwright executable is missing while Google Chrome or Chromium is installed on the host
- **THEN** `runHarness()` launches the system browser automatically and completes verification without throwing a missing-executable error.

### Requirement: Manifest-Aware Expected Startup Theme Verification
The structural verification check (`core:structure`) SHALL read the expected startup theme from the embedded `#agent-manifest` JSON (`theme` property) or an explicit `--expected-theme <name>` CLI option, defaulting to `light` only when neither is specified.

#### Scenario: Report built with `--theme dracula` passes structure check
- **WHEN** a report assembled with `--theme dracula` (which stamps `<html data-theme="dracula">` and `"theme": "dracula"` in `#agent-manifest`) is verified via `verify-report.mjs`
- **THEN** `core:structure` validates that `<html data-theme>` and `#active-theme-label` match `dracula` and passes without requiring `light`.

### Requirement: Composite Chart Palette Verification on Theme Switch
The theme-switcher verification check (`core:theme-switcher`) SHALL verify reactive chart palette updates by inspecting a composite palette signature across datasets and scales (`borderColor`, scalar or array-valued `backgroundColor`, and scale tick/grid colors) rather than requiring `datasets[0].borderColor` alone.

#### Scenario: Borderless bar chart with array-valued background fills passes theme check
- **WHEN** a report contains a Chart.js bar chart whose dataset defines an array of theme-derived `backgroundColor` values and no `borderColor` (or `borderWidth: 0`)
- **THEN** switching themes during `core:theme-switcher` detects the updated `backgroundColor` palette and passes `reactive-palette-sync`.

### Requirement: First-Class HTTP URL Verification Mode
The Playwright verifier SHALL accept `--url <http://...>` (or an `http://` / `https://` target positional argument) to run verification checks against a live server-backed report in addition to local `file://` paths.

#### Scenario: Verifying a live server-backed report over HTTP
- **WHEN** `verify-report.mjs --url http://localhost:3031/ --quick --json live-check.json` is executed against a running report server
- **THEN** the harness navigates to `http://localhost:3031/`, executes all applicable checks against the live HTTP origin, and writes `live-check.json`.
