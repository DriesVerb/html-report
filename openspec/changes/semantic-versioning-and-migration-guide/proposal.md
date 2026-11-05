# Proposal: Semantic Versioning & Migration Assistance for Downstream Consumers

> Companion Dashboard: [index.html](file:///home/eta/projects/html-report/openspec/changes/semantic-versioning-and-migration-guide/index.html) | Servable at `http://localhost:3000`  
> Direct Backlinks: [design.md](file:///home/eta/projects/html-report/openspec/changes/semantic-versioning-and-migration-guide/design.md) | [tasks.md](file:///home/eta/projects/html-report/openspec/changes/semantic-versioning-and-migration-guide/tasks.md) | [specs/semantic-versioning/spec.md](file:///home/eta/projects/html-report/openspec/changes/semantic-versioning-and-migration-guide/specs/semantic-versioning/spec.md)

## Why

As `html-report` is increasingly adopted as a dependency within external libraries, toolchains, and AI agent frameworks, downstream consumers require predictable stability guarantees. Without formal Semantic Versioning (SemVer 2.0.0), any change to CLI arguments, programmatic exports, template token contracts, or runtime data structures risks breaking consumer integrations. Furthermore, when breaking changes (`MAJOR` version bumps) inevitably occur, human developers and AI coding agents need immediate, automated assistance—including structured deprecation errors, CLI diagnostic checks, and turnkey, copy-paste AI migration prompts to upgrade downstream codebases with zero friction.

## What Changes

- **Root NPM Package & Library Distribution (`package.json`)**: Establish formal package configuration declaring the canonical version (`1.0.0`), dual bin entries (`html-report`, `html-report-serve`), subpath exports (`./build`, `./harness`, `./serve`, `./pwa`, `./theme`), and Node.js engine compatibility.
- **Formal Public API Contract & SemVer 2.0.0 Policy**: Explicitly define what constitutes the public surface across CLI commands, programmatic JS exports, template shell slot contracts, Datastar SSE protocols, and `SKILL.md` triggers. Define strict criteria for `PATCH` (fixes/docs), `MINOR` (backward-compatible features), and `MAJOR` (breaking changes).
- **Graceful Deprecation & Breaking Change Detection Interceptors**: Add runtime guards in `build-report.mjs`, `harness.mjs`, `serve-report.mjs`, and `pwa-builder.mjs` that catch deprecated or retired flags/options and emit structured, actionable migration notices rather than obscure runtime errors.
- **AI Agent Migration Prompt Standard & Versioned Migration Guides**: Create a dedicated `docs/migrations/` hub with comprehensive migration guides for breaking changes. Each guide provides both human-readable instructions and a standardized, turnkey `<AI_MIGRATION_PROMPT>` that downstream library authors can paste directly into Antigravity, Claude Code, Cursor, or Codex to execute automated codemods.
- **CLI Migration & Compatibility Diagnostic Tool**: Implement a diagnostic command (`node skills/html-report/scripts/harness.mjs check-compatibility` or programmatic helper) to audit consumer fragments, configs, and scripts for deprecated parameters and breaking API usages.
- **OpenSpec SemVer Impact Tagging**: Integrate SemVer classification into future OpenSpec changes, guaranteeing that every architectural delta explicitly notes its version impact (`patch`, `minor`, `major`) and links corresponding migration guide entries.

## Capabilities

### New Capabilities
- `semantic-versioning`: Covers SemVer 2.0.0 compliance, public API surface definitions, root package distribution, deprecation lifecycle policies, breaking change detection interceptors, and copy-paste AI migration prompts.

### Modified Capabilities
- `skill-packaging`: Extends skill distribution to document package consumption, semver guarantees, and downstream library integration.

## Impact

- **Package Structure**: Adds root `package.json` with ESM exports and CLI bin aliases.
- **CLI & Scripts**: Enhances CLI argument parsers (`build-report.mjs`, `harness.mjs`, `serve-report.mjs`) with deprecation alias tracking and helpful migration banners.
- **Documentation**: Adds `docs/semantic-versioning.md`, `MIGRATION.md`, and versioned migration guides in `docs/migrations/`.
- **Testing**: Adds automated tests validating SemVer export resolution, deprecation warning emission, and migration prompt integrity.
