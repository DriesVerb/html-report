# Spec: Profile Resolution & Precedence (`profile-resolution`)

## Requirements

### Requirement: Profile Schema & Compatibility Check
The system SHALL parse YAML frontmatter from `.caller-requests/profiles/<caller-id>.md` and validate:
1. `schema_version`: Currently `1`.
2. `reporter_compatibility`: Semver expression compatible with the active `html-report` engine version (e.g., `>=1.0.0`).
If the version check fails, the engine SHALL warn the user and safely degrade to base defaults.

#### Scenario: Valid profile schema load
- **GIVEN** a profile with `schema_version: 1` and `reporter_compatibility: ">=1.0.0"`
- **WHEN** the engine reads the profile
- **THEN** it SHALL extract `default_theme`, `required_cdns`, and `instructions`.

### Requirement: Instruction Merge Precedence
The report engine SHALL resolve instructions following this strict hierarchy:
1. **Core Quality Standards** (Immutable baseline: 11-CDN availability, valid HTML5, responsive navbar, DaisyUI themes).
2. **Caller Profile Rules** (Overrides/supplements default sections, themes, charts).
3. **Runtime Ephemeral Overrides** (One-off flags passed in the current run payload).

#### Scenario: Runtime override takes precedence over profile
- **GIVEN** a caller profile specifying `default_theme: "dark"`
- **WHEN** the run payload specifies `theme: "nord"`
- **THEN** the generated report SHALL use `data-theme="nord"`.

### Requirement: Non-Destructive Mutation Policy
Runtime overrides and one-off run parameters SHALL NOT alter the contents or timestamp of the persistent profile file in `.caller-requests/profiles/<caller-id>.md`.

#### Scenario: Persistent profile untouched after run with overrides
- **GIVEN** an existing profile `.caller-requests/profiles/perf-test.md` with SHA256 hash `H0`
- **WHEN** a report is generated with temporary runtime instructions and overrides
- **THEN** the hash of `.caller-requests/profiles/perf-test.md` SHALL remain `H0`.
