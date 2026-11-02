# Spec: Caller Vault (`caller-vault`)

## ADDED Requirements

### Requirement: Top-Level Gitignored Vault Directory
The system SHALL store all caller configuration and run payloads inside `.caller-requests/` located at the repository workspace root, and this path SHALL be listed in `.gitignore`.

#### Scenario: Git exclusion verification
- **GIVEN** a clean repository
- **WHEN** `.caller-requests/` is created
- **THEN** `git status --porcelain` SHALL NOT report `.caller-requests` as untracked.

### Requirement: Persistent Caller Profile Storage
The system SHALL store persistent caller configurations in `.caller-requests/profiles/<caller-id>.md`.
The file format SHALL be Markdown with YAML frontmatter adhering to `schema_version: 1`.

#### Scenario: Initial caller profile auto-generation
- **GIVEN** an invocation with caller ID `memory-leak-debugging` and no pre-existing profile
- **WHEN** the profile loader runs
- **THEN** it SHALL scaffold `.caller-requests/profiles/memory-leak-debugging.md` with default metadata, theme, and sections.

### Requirement: Ephemeral Run Retention Policy
The system SHALL store individual run payloads inside `.caller-requests/runs/<caller-id>/<run-id>/`.
When a new run payload is recorded, the engine SHALL retain at most the **10 most recent runs** for that specific `<caller-id>` (ordered by timestamp or directory creation time) and SHALL automatically delete older run directories.

#### Scenario: 11th run payload triggers pruning
- **GIVEN** 10 existing run directories in `.caller-requests/runs/benchmark-tool/`
- **WHEN** an 11th run payload directory is written
- **THEN** the oldest run directory SHALL be automatically purged, leaving exactly 10 runs.

### Requirement: Default Output File Path Routing
When a caller does NOT provide an explicit output file path, the generator SHALL emit reports to the caller tool's current working directory using the format:
- `./report-<caller-id>.html`
- `./report-<caller-id>.pdf`

#### Scenario: Default output path generation
- **GIVEN** an invocation from `a11y-debugging` without an `--output` argument
- **WHEN** the report compiles
- **THEN** the files SHALL be written to `./report-a11y-debugging.html` and `./report-a11y-debugging.pdf`.

### Requirement: Direct Leaf Caller Identification
In hierarchical or nested subagent calling chains (e.g., `orchestrator` invoking `worker-agent` which invokes `html-report`), the system SHALL identify the caller by its immediate leaf identifier.

#### Scenario: Nested calling chain resolution
- **GIVEN** a workflow where `teamwork` launches `debug-optimize-lcp`
- **WHEN** `debug-optimize-lcp` invokes `html-report`
- **THEN** the caller ID SHALL resolve to `debug-optimize-lcp`.
