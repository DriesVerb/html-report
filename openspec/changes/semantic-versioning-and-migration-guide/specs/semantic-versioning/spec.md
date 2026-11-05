# semantic-versioning Specification

## Purpose

Defines the Semantic Versioning (SemVer 2.0.0) standard, public API surface boundary, root NPM/Node.js library distribution, deprecation lifecycle policies, runtime breaking change detection interceptors, and copy-paste AI migration prompts for downstream library consumers.

## ADDED Requirements

### Requirement: Root Package Distribution and Semantic Version Declaration
The system SHALL provide a canonical `package.json` file at repository root defining `name: "html-report"`, SemVer-compliant `version`, ESM module type, subpath exports (`./build`, `./harness`, `./serve`, `./pwa`, `./theme`), dual CLI bin aliases, and compatible Node.js engines.

#### Scenario: Resolving programmatic library exports
- **WHEN** an external project imports `"html-report"` or subpaths like `"html-report/build"`
- **THEN** it MUST resolve to canonical ESM script modules with valid exports.

#### Scenario: CLI executable discovery and version query
- **WHEN** a user or script invokes `npx html-report` or executes `--version`
- **THEN** the system MUST output the current SemVer string matching `package.json`.

---

### Requirement: Semantic Versioning Presentation in README and Report Footer
The system SHALL prominently display its Semantic Versioning status and version number in `README.md` and in the footer of every generated HTML report.

#### Scenario: SemVer display in README
- **WHEN** a user or downstream developer inspects `README.md`
- **THEN** it MUST display a SemVer 2.0.0 badge, current version indicator, and a Semantic Versioning commitment section.

#### Scenario: SemVer display in report footer
- **WHEN** an HTML report is compiled via `build-report.mjs`
- **THEN** the footer at the bottom of the report MUST display `html-report` accompanied by the active SemVer version number and a SemVer indicator.

---

### Requirement: Public API Boundary and SemVer Change Classification
The system SHALL define a strict boundary for its public API surface (CLI flags, programmatic exports, template shell token contracts, Datastar SSE events, and `SKILL.md` triggers) and classify changes according to SemVer 2.0.0 rules (`PATCH`, `MINOR`, `MAJOR`).

#### Scenario: Classifying backward-compatible additions
- **WHEN** a new optional CLI flag, new CDN addon, or new programmatic export is introduced
- **THEN** it SHALL be classified as a MINOR version increment with zero breaking changes to existing signatures.

#### Scenario: Classifying breaking modifications
- **WHEN** an existing CLI flag or export signature is removed or altered incompatibly
- **THEN** it SHALL be classified as a MAJOR version increment requiring deprecation notices and a migration guide.

---

### Requirement: Graceful Deprecation and Breaking Change Interceptors
The CLI and programmatic interfaces SHALL intercept deprecated or retired flags and options, emitting prominent, structured migration guidance with exact replacement instructions and documentation links instead of unhandled errors.

#### Scenario: Intercepting deprecated CLI flags
- **WHEN** a consumer invokes a CLI script with a deprecated or retired flag
- **THEN** the harness SHALL emit a structured warning or remediation banner referencing the replacement flag, migration guide URL, and AI prompt.

#### Scenario: Intercepting breaking programmatic API options
- **WHEN** a consumer passes retired or renamed options to programmatic functions
- **THEN** the function SHALL log an actionable deprecation error or warning with migration instructions before applying fallback defaults.

---

### Requirement: AI Agent Migration Prompt Standard and Versioned Guides
The repository SHALL maintain versioned migration documentation in `docs/migrations/` and `MIGRATION.md` containing human-readable diff guides and machine-executable `<AI_MIGRATION_PROMPT>` blocks optimized for AI coding assistants.

#### Scenario: Accessing migration guide with turnkey AI prompt
- **WHEN** a developer or agent reviews a major version migration guide (e.g. `docs/migrations/v1-to-v2.md`)
- **THEN** the guide MUST provide an explicit copy-paste `<AI_MIGRATION_PROMPT>` that instructs an AI agent to scan downstream codebases and execute automated codemods.

---

### Requirement: CLI Compatibility and Migration Diagnostic Tool
The system SHALL provide a diagnostic mode (`--check-compatibility` or migration audit tool) that analyzes consumer report fragments, configuration files, and invocation scripts against the current SemVer contract.

#### Scenario: Auditing consumer codebase for compatibility
- **WHEN** the diagnostic command is executed against a project directory
- **THEN** it SHALL report all deprecated or incompatible usages, their target replacements, and the corresponding migration guide.
