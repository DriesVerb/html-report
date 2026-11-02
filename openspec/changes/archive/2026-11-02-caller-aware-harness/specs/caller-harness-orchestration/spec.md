# caller-harness-orchestration Specification

## Purpose
Marries caller-aware profile resolution, vault lifecycle management, and output routing with deterministic state machine harness execution, providing a single-command interface for external agent skills while preserving a zero-complexity standalone execution path.

## ADDED Requirements

### Requirement: Zero-Overhead Standalone Invariance
The harness CLI SHALL execute in a lightweight standalone mode when `--caller` is omitted, bypassing caller resolution, avoiding any creation or modification of `.caller-requests/` directories, and outputting to `./report.html`.

#### Scenario: Standalone execution creates no vault files
- **WHEN** user invokes `node scripts/harness.mjs run fragment.html` without `--caller`
- **THEN** the harness does not create, read, or write any files in `.caller-requests/`, outputs report to `./report.html`, and completes using core baseline settings

#### Scenario: Standalone FSM state bypass
- **WHEN** harness executes in standalone mode
- **THEN** state transitions bypass `RESOLVING_CALLER` and `RECORDING_RUN`, transitioning directly from `IDLE` to `VALIDATING`

### Requirement: Caller Profile Resolution in FSM
The harness CLI SHALL support a `RESOLVING_CALLER` state when `--caller <id>` is provided that extracts the leaf caller identifier, locates or auto-scaffolds the caller profile, and validates schema version and reporter compatibility.

#### Scenario: Auto-scaffold new caller profile
- **WHEN** harness is invoked with `--caller <new-caller-id>` and no profile exists
- **THEN** the harness generates a baseline profile in `.caller-requests/profiles/<new-caller-id>.md` and transitions to `VALIDATING`

#### Scenario: Incompatible schema or reporter rejection
- **WHEN** harness resolves a profile with an unsupported schema version or conflicting compatibility requirement
- **THEN** the harness transitions to `FAILED` and outputs a descriptive configuration error

#### Scenario: Normalization of chained caller identifiers
- **WHEN** harness is invoked with chained caller string `--caller teamwork/subagents/debug-optimize-lcp`
- **THEN** the leaf caller `debug-optimize-lcp` is extracted for profile resolution, output file naming, and vault directory scoping

### Requirement: Profile-Driven Assembly Parameters
The harness CLI SHALL inject caller profile settings (`default_theme`, `required_cdns`, `reportMode`) into report assembly in caller-aware mode while honoring runtime CLI overrides.

#### Scenario: Custom profile theme applied
- **WHEN** caller profile defines `default_theme: "synthwave"` and no runtime `--theme` is supplied
- **THEN** the assembled HTML report defaults to `data-theme="synthwave"`

#### Scenario: Runtime override precedence
- **WHEN** caller profile defines `default_theme: "synthwave"` but CLI specifies `--theme cupcake`
- **THEN** the assembled report uses `cupcake` and the caller profile on disk is not modified

### Requirement: Caller-Aware Default Output Routing
The harness CLI SHALL route default output deliverables to `./report-<caller>.html` (and `./report-<caller>.pdf`) in the caller's working directory when `--output` is not specified.

#### Scenario: Default HTML and PDF naming
- **WHEN** harness executes with `--caller memory-leak-debugging` and no `--output` flag
- **THEN** output files are created at `./report-memory-leak-debugging.html` (and `./report-memory-leak-debugging.pdf` if `--pdf` is requested)

#### Scenario: Explicit output path override
- **WHEN** harness executes with `--caller memory-leak-debugging` and an explicit `--output ./custom/dest.html`
- **THEN** output is written to `./custom/dest.html` instead of the default caller path

### Requirement: Ephemeral Vault Run and Trace Recording
The harness CLI SHALL persist structured `run.json` and `trace.json` files inside `.caller-requests/runs/<callerId>/<runId>/` and enforce the 10-run retention limit in caller-aware mode.

#### Scenario: Run trace recorded in vault
- **WHEN** a caller run finishes or requires remediation
- **THEN** the harness writes execution traces, FSM state history, and remediation directives to the caller's ephemeral run directory and prunes runs exceeding 10

#### Scenario: Correlated multi-attempt tracking via run-id
- **WHEN** harness executes remediation retry with `--caller memory-leak-debugging --attempt 2 --run-id <existing-run-id>`
- **THEN** the harness updates the existing run directory with attempt 2 history and remediation progression rather than creating an unrelated run
