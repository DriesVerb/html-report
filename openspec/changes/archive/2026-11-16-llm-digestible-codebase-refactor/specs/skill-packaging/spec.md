# Delta Specification: skill-packaging (LLM-Digestible Modularization)

## ADDED Requirements

### Requirement: Bounded Source Module Sizes for LLM Navigation
All runtime and script source modules (`.mjs`, `.js`) inside `packages/core/scripts/`, `packages/core/assets/`, `packages/studio/scripts/`, and `packages/studio/assets/` SHALL remain concise and focused (`<= 650` lines per file), and `packages/studio/assets/create.html` SHALL extract inline application scripts into `packages/studio/assets/create-studio/*.js` so `create.html` remains `<= 1,600` lines.

#### Scenario: Automated digestibility guard verifies module size budgets
- **WHEN** `packages/core/tests/codebase-digestibility.test.mjs` scans `packages/core/` and `packages/studio/`
- **THEN** every `.mjs` and `.js` source module is `<= 650` lines
- **AND** `packages/studio/assets/create.html` is `<= 1,600` lines with all `create-studio/*.js` modules present and syntax-valid.

### Requirement: Package-Level LLM Orientation Maps
The repository SHALL maintain an architecture and module navigation map in `AGENTS.md` and `docs/codebase-map.md`, plus dedicated package guides at `packages/core/README.md` and `packages/studio/README.md` documenting public exports, CLI entrypoints, and internal `lib/` / `assets/` modules.

#### Scenario: Agent inspects package orientation documentation
- **WHEN** an AI agent reads `AGENTS.md`, `packages/core/README.md`, or `packages/studio/README.md`
- **THEN** it finds accurate module paths, responsibility summaries, and workspace boundary rules without scanning large files first.
