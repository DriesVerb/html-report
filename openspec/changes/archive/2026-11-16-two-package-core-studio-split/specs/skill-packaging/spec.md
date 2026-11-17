# skill-packaging Delta Specification

> **Change:** `2026-11-16-two-package-core-studio-split` | **Base Spec:** [`openspec/specs/skill-packaging/spec.md`](../../../../specs/skill-packaging/spec.md)

## MODIFIED Requirements

### Requirement: Portable Agent Skill Directory Layout
The repository SHALL store the canonical skill facades at `skills/html-report/` (and sibling `skills/html-*` directories) containing `SKILL.md`, `references/`, `examples/`, and thin CLI entrypoints delegating to the workspace packages (`packages/core` and `packages/studio`), while `packages/core` SHALL own the deterministic compiler/verifier implementation and `packages/studio` SHALL own the Creation Studio, live server, and AI/MCP workbench.

#### Scenario: Skill directory structure inspection with two-package workspace
- **WHEN** a user or agent inspects `skills/html-report/` and `.agents/skills/html-report`
- **THEN** `SKILL.md` (`<5KB`), `references/architecture-and-styling.md`, `references/charts-and-mermaid-style-guide.md`, and `examples/example.html` remain accessible at their canonical paths
- **AND** `.agents/skills/*` relative symlinks continue resolving cleanly to `../../skills/*`.

## ADDED Requirements

### Requirement: Strict Two-Package Workspace Boundary (`@html-report/core` and `@html-report/studio`)
The repository SHALL organize its runtime implementation into two npm workspace packages under `packages/core/` (`@html-report/core`) and `packages/studio/` (`@html-report/studio`), where `@html-report/core` has zero imports from `@html-report/studio` and `@html-report/studio` imports `@html-report/core` exclusively through its declared `package.json` subpath exports.

#### Scenario: Boundary test rejects cross-package deep imports
- **WHEN** the package boundary test scans `packages/core/` and `packages/studio/`
- **THEN** `packages/core/` contains zero references to `@html-report/studio` or `packages/studio`
- **AND** `packages/studio/` contains zero relative path imports reaching into `packages/core/scripts/` or `packages/core/assets/` internals outside declared package exports.

### Requirement: Repository Root Hygiene and Offline vs. E2E Test Partitioning
The repository root SHALL NOT retain duplicate copies of `create.html`, temporary BDD scratch directories (`tmp-pwa-bdd/`), or studio-only PWA root manifests alongside package source; Studio PWA assets SHALL live under `packages/studio/public/`, and automated tests SHALL be partitioned so offline unit/integration suites (`npm test`) pass without internet access while CDN-dependent Playwright suites run via `npm run test:e2e`.

#### Scenario: Running offline unit and integration tests without network access
- **WHEN** `npm test` executes in an offline environment
- **THEN** all core, studio, and boundary unit/integration tests pass with zero `ERR_INTERNET_DISCONNECTED` failures
- **AND** CDN-dependent browser suites are cleanly isolated under `npm run test:e2e`.
