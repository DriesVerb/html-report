# Spec Delta: Domain Code Alignment

## Purpose
Ensures all core scripts, runtime assets, sibling skill facades, MCP tool schemas, and documentation strictly conform to the canonical Ubiquitous Domain Language.

## ADDED Requirements

### Requirement: Canonical Terminology in Core CLI & MCP Interfaces
All CLI `--help` output, error messages, and MCP tool schemas (`NATIVE_MCP_TOOLS`) MUST use canonical domain terms (`Semantic Fragment`, `Template Shell`, `Assembly`, `Pipeline`, `Published Document`) and MUST NOT emit deprecated synonyms (`snippet`, `partial`, `bundler`).

#### Scenario: Auditing CLI and MCP schemas for deprecated terms
- **GIVEN** the CLI help text in `build-report.mjs` and tool schemas in `mcp-server.mjs`
- **WHEN** scanned against `UBIQUITOUS_GLOSSARY` deprecated synonyms
- **THEN** zero deprecated terms appear in user-facing or agent-facing schemas.

### Requirement: Create Mode Two-Axis Selection
The Creation Studio (`create.html`) MUST allow users to select Two-Axis Runtime Classification (`Static File` vs. `Server-Connected`, `Passive` vs. `Interactive`) for human-facing Output Deliverables, while Beneficiary classification (`User-Facing`, `Agent-Facing`, `Hybrid`) remains a development-time feature rubric.

#### Scenario: Generating a Static Interactive prompt in Studio
- **WHEN** a user selects `Static File` and `Interactive` in `create.html`
- **THEN** the synthesized prompt specifies `Static File` + `Interactive / Reactive` and omits unnecessary Datastar server hooks.

### Requirement: PWA as Offline Packaging Modifier
The domain model and skill documentation MUST represent PWA (`--pwa`) as an Offline Packaging Modifier applicable to any Interactive Delivery Archetype without conflicting with content archetypes.

#### Scenario: Combining PWA packaging with Analytical Report archetype
- **GIVEN** a configuration targeting `@html-report` with `offline-app` packaging
- **WHEN** normalized via `normalizeDomainConfig()`
- **THEN** it retains the `@html-report` archetype and appends `--pwa` packaging flags cleanly.
