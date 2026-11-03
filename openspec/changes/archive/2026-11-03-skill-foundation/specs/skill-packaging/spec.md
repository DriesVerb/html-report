# Spec Delta

## Purpose

Defines the portable, LLM-agnostic directory layout, metadata contract, progressive disclosure organization, example showcase, Playwright verification tooling, and local symlink discovery for the `html-report` Agent Skill.

## ADDED Requirements

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
