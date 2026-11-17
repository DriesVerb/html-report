# skill-packaging Specification

## Purpose

Defines the portable, LLM-agnostic directory layout, metadata contract, progressive disclosure organization, example showcase, Playwright verification tooling, and local symlink discovery for the `html-report` Agent Skill.

## Requirements

### Requirement: Portable Agent Skill Directory Layout
The repository SHALL store the canonical skill facades at `skills/html-report/` (and sibling `skills/html-*` directories) containing `SKILL.md`, `references/`, `examples/`, and thin CLI entrypoints delegating to the workspace packages (`packages/core` and `packages/studio`), while `packages/core` SHALL own the deterministic compiler/verifier implementation and `packages/studio` SHALL own the Creation Studio, live server, and AI/MCP workbench.

#### Scenario: Skill directory structure inspection
- **WHEN** a user or agent inspects `skills/html-report/`
- **THEN** `SKILL.md`, `references/architecture-and-styling.md`, `references/charts-and-mermaid-style-guide.md`, `examples/example.html`, and `playwright/` exist in their canonical paths

#### Scenario: Skill directory structure inspection with two-package workspace
- **WHEN** a user or agent inspects `skills/html-report/` and `.agents/skills/html-report`
- **THEN** `SKILL.md` (`<5KB`), `references/architecture-and-styling.md`, `references/charts-and-mermaid-style-guide.md`, and `examples/example.html` remain accessible at their canonical paths
- **AND** `.agents/skills/*` relative symlinks continue resolving cleanly to `../../skills/*`.

### Requirement: LLM-Agnostic Skill Frontmatter and Instructions
`skills/html-report/SKILL.md` SHALL begin with YAML frontmatter defining `name: html-report` and a third-person `description` explaining what the skill does and when to activate it, and its body SHALL NOT depend on vendor-specific LLM tool names.

#### Scenario: Frontmatter and vendor-neutral validation
- **WHEN** an agent harness parses `skills/html-report/SKILL.md`
- **THEN** the YAML frontmatter provides valid `name` and `description` fields and the markdown body contains only standard markdown and portable relative links

### Requirement: Progressive Disclosure of Architecture and Visualization Style Guides
The skill SHALL keep `skills/html-report/SKILL.md` concise and link to `./references/architecture-and-styling.md` for layout/CDN patterns and `./references/charts-and-mermaid-style-guide.md` for Chart.js and Mermaid standards.

#### Scenario: On-demand reference loading
- **WHEN** an agent activates `skills/html-report/SKILL.md` to build a report with charts or diagrams
- **THEN** `SKILL.md` directs the agent to read `./references/architecture-and-styling.md` and `./references/charts-and-mermaid-style-guide.md` via relative links

### Requirement: Local Workspace Symlink Discovery
The repository SHALL expose `.agents/skills/html-report` as a relative symlink pointing to `../../skills/html-report` so local agent harnesses discover the skill automatically while `skills/html-report/` remains the single source of truth.

#### Scenario: Resolving the local workspace skill symlink
- **WHEN** an agent or developer resolves `.agents/skills/html-report/SKILL.md`
- **THEN** it resolves directly to `skills/html-report/SKILL.md`

### Requirement: Ephemeral `projects/` Output Workspace (`.gitignore` & Git Hygiene)
The repository SHALL ignore the `projects/` directory in `.gitignore` and SHALL NOT track generated user or test reports under `projects/` in git version control history.

#### Scenario: Generated reports in `projects/` are ignored by git
- **WHEN** `scaffold-project.mjs --project sample-report` creates `projects/sample-report/index.html`
- **THEN** `git status --porcelain projects/` reports zero untracked or modified files and `git ls-files projects/` is empty.

### Requirement: Dedicated Default Ports (`3031` / `3032`) & Pre-Authoring Environment Preflight CLI
The skill SHALL default project servers and the Turnkey AI Bridge to port `3031` (with `3032` as secondary/fallback port rather than `3000`), and SHALL provide `skills/html-report/scripts/preflight.mjs` to check canonical skill path resolution, port availability (`3031`/`3032`), Playwright or system Chrome availability, and available AI inference providers before authoring begins.

#### Scenario: Running environment preflight CLI
- **WHEN** `node skills/html-report/scripts/preflight.mjs --json` is executed
- **THEN** it outputs a structured JSON diagnostic containing `skillRoot`, `ports` (`3031`, `3032`, and `recommendedPort`), `browser` (`playwrightChromium`, `systemChrome`, `ready`), and `ai` (`providerAvailable`, `activeProvider`, `checkedProviders`).

### Requirement: Vertical-Slice Authoring Workflow Documentation
`skills/html-report/SKILL.md` and `skills/html-report/references/agent-authoring-guide.md` SHALL document the 7-step vertical-slice authoring workflow (Preflight, Feature Contract, Minimal Vertical Slice, Content Expansion, Readiness-Based Browser Checks, HTTP vs `file://` Verification, and Isolated Test State), explicit Datastar `@get`/`@post` syntax, and responsive `<canvas>` `min-w-0` grid constraints.

#### Scenario: Agent reads authoring workflow guidance
- **WHEN** an agent inspects `skills/html-report/SKILL.md` and `skills/html-report/references/agent-authoring-guide.md`
- **THEN** both documents specify the vertical-slice verification step before full content expansion and warn against `$get` Datastar syntax and unconstrained flex/grid `<canvas>` containers.

### Requirement: Responsive Scaffold Defaults and Explicit Port-Fallback Warning
`scaffold-project.mjs` SHALL emit a responsive CSS Grid KPI container (`grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4`) instead of `stats-vertical lg:stats-horizontal`, preserve `--ai-port` and `--ai-persona` in generated rebuild commands, and `serve-report.mjs` SHALL emit a prominent warning banner whenever an explicitly requested `--port` is busy and falls back to an alternate port.

#### Scenario: Scaffolded 4-KPI layout passes Playwright `lg` (`1024px`) verification
- **WHEN** a new project is scaffolded with `scaffold-project.mjs` and populated with 4 KPI cards
- **THEN** `verify-report.mjs` reports `0px` overflow and `0` elements with `[data-insufficient-space="true"]` at `sm` (`640px`) and `lg` (`1024px`).

#### Scenario: Explicit `--port 3031` collision displays a clear fallback notice
- **WHEN** `serve-report.mjs` is invoked with `--port 3031` while port `3031` is already occupied
- **THEN** the startup banner explicitly warns that port `3031` was busy and displays the actual bound port (e.g., `3034`) so users do not connect to an unrelated server on `:3031`.

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

### Requirement: Zero-Install Workspace Package Resolution & Supervisor Flag Forwarding
The repository SHALL keep `node_modules/@html-report/` workspace symlinks un-ignored, provide a zero-dependency ESM workspace loader (`packages/core/scripts/workspace-loader.mjs`), and preserve `process.execArgv` across all CLI shims, `server-policy.mjs`, and `supervisor.mjs`.

#### Scenario: Preview server supervisor preserves Node loader flags
- **WHEN** `serve-report.mjs` or `supervisor.mjs` spawns a child worker with active `process.execArgv` (such as `--import`)
- **THEN** the child worker inherits those loader flags alongside `--no-open` / `--port` arguments.

### Requirement: Reconciled Skill & Reference Stack Guidance
`skills/html-report/SKILL.md` (`<= 5,120` bytes) and `skills/html-report/references/architecture-and-styling.md` SHALL accurately document the Core 4 shell + 15 on-demand addons, direct `.mmd` file inclusion, verification selection semantics, gitignored `projects/`, and SSE live-reload waiting behavior.
