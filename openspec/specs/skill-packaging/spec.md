# skill-packaging Specification

## Purpose

Defines the portable, LLM-agnostic directory layout, metadata contract, progressive disclosure organization, example showcase, Playwright verification tooling, and local symlink discovery for the `html-report` Agent Skill.

## Requirements

### Requirement: Portable Agent Skill Directory Layout
The repository SHALL store the canonical skill package at `skills/html-report/` containing `SKILL.md`, `references/`, `examples/`, and `playwright/` subdirectories.

#### Scenario: Skill directory structure inspection
- **WHEN** a user or agent inspects `skills/html-report/`
- **THEN** `SKILL.md`, `references/architecture-and-styling.md`, `references/charts-and-mermaid-style-guide.md`, `examples/example.html`, and `playwright/` exist in their canonical paths

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
