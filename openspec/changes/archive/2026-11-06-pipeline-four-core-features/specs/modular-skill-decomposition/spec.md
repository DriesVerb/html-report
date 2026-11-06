# Spec Delta: Modular Skill Decomposition (Matt Pocock Pattern)

## Purpose
Decomposes the monolithic `html-report` agent skill into razor-sharp, specialized `<5KB` skill facades (`html-report`, `html-print`, `html-dashboard`, `html-presentation`, `html-pwa`, `html-create`) atop a shared zero-duplication core engine, eliminating prompt bloat and enabling deterministic skill discovery and intent routing.

## ADDED Requirements

### Requirement: Specialized Token-Efficient Skill Facades (Matt Pocock Pattern)
The repository MUST provide modular, specialized skill facades where each `SKILL.md` is strictly under 5,120 bytes (5.0 KB), focusing exclusively on its target domain to reduce prompt tokens by up to 80%.

#### Scenario: Inspecting modular skill facade sizes
- **WHEN** an agent or test harness audits all canonical skill packages (`html-report`, `html-print`, `html-dashboard`, `html-presentation`, `html-pwa`, `html-create`)
- **THEN** each `SKILL.md` file size is strictly less than or equal to 5,120 bytes
- **AND** each frontmatter specifies a concise third-person description and distinct domain scope.

### Requirement: Zero Code & Asset Duplication
All specialized skill facades MUST share the canonical CLI scripts and assets located in `skills/html-report/` without duplicating runtime code or CSS across sibling directories.

#### Scenario: Verifying shared core engine utilization
- **WHEN** the file tree of sibling skill packages is inspected
- **THEN** sibling packages (`html-print`, `html-dashboard`, `html-presentation`, `html-pwa`, `html-create`) do not contain duplicate `scripts/` or `assets/` subdirectories
- **AND** each facade executes against the shared `skills/html-report/` engine via portable relative paths.

### Requirement: Local Workspace Symlink Discovery
The repository MUST expose each specialized skill in `.agents/skills/<name>` as a relative symlink pointing to `../../skills/<name>` so local agent harnesses discover every skill automatically.

#### Scenario: Resolving modular skills from .agents/skills/
- **WHEN** an agent platform scans `.agents/skills/` for available capabilities
- **THEN** all canonical skills (`html-report`, `html-print`, `html-dashboard`, `html-presentation`, `html-pwa`, `html-create`) resolve directly to their canonical packages
- **AND** each resolved `SKILL.md` is parseable with valid YAML frontmatter metadata.

### Requirement: Unambiguous Intent Routing and Intent Benchmark
The skill routing engine MUST deterministically match user intents, slash commands, and domain prompts to the optimal specialized skill facade with high accuracy.

#### Scenario: Routing domain prompts to specialized skills
- **WHEN** domain-specific prompts representing reports, print/PDFs, live telemetry, presentations, PWAs, and decision wizards are routed
- **THEN** the router returns the correct specialized skill
- **AND** benchmark accuracy across domain phrases achieves at least 95%.
