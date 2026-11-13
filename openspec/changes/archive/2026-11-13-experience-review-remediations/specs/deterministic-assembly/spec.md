# deterministic-assembly Delta Specification

## MODIFIED Requirements

### Requirement: HTML Body Fragment Injection
The builder CLI SHALL accept a semantic `<main>` HTML content fragment, inject its inner content into the pre-generated DaisyUI report shell, and preserve reactive or application attributes authored on the `<main>` element (`id`, `x-data`, `x-init`, `x-*`, `@*`, `data-*`, `aria-*`, and custom CSS classes merged with the shell's layout classes).

#### Scenario: Successful fragment assembly
- **GIVEN** a content fragment file containing DaisyUI cards and stats
- **WHEN** `node scripts/build-report.mjs --title "Test Report" --content fragment.html --output report.html` is executed
- **THEN** the output HTML contains the full document shell with `<main id="report-main">` populated by the fragment content.

#### Scenario: Reactive Alpine attributes on `<main>` survive assembly
- **GIVEN** a content fragment whose root element is `<main id="report-main" x-data="stoneBoard" x-init="boot()" data-board-version="1" class="custom-board-grid">`
- **WHEN** `build-report.mjs` assembles the fragment into the report shell
- **THEN** the output document's `<main>` element retains `id="report-main"`, `x-data="stoneBoard"`, `x-init="boot()"`, `data-board-version="1"`, and merges `custom-board-grid` with the shell's default `<main>` classes so Alpine initializes on page load.

## ADDED Requirements

### Requirement: Conditional AI Assistant Chrome Injection
The builder CLI SHALL omit `#agent-dock-container` and `#agent-reconnect-modal` markup from the assembled HTML when `ai` is `false` (default), including them only when `--ai` / `ai: true` is enabled (and not `--published`).

#### Scenario: Standard report without `--ai` omits AI dock DOM
- **WHEN** `build-report.mjs` assembles a report without `--ai`
- **THEN** the output HTML does not contain `#agent-dock-container` or `#agent-reconnect-modal`, reducing default DOM footprint.

#### Scenario: Report built with `--ai` includes AI dock DOM on default port `3031`
- **WHEN** `build-report.mjs --ai` assembles a report without an explicit `--ai-port`
- **THEN** the output HTML includes `#agent-dock-container` and `<meta name="html-report-ai-port" content="3031" />`.

### Requirement: Installation-Aware Project Scaffolding Commands & Local Runner Scripts
The project scaffolder and manifest generator SHALL emit `rebuildCommand`, `serveCommand` (defaulting to port `3031`), and documentation paths resolved dynamically against the active skill installation path and target workspace root, and SHALL generate a project-local `package.json` with `build`, `serve`, `verify`, and `preflight` scripts inside `projects/<slug>/`.

#### Scenario: Scaffolding inside the html-report monorepo
- **WHEN** `scaffold-project.mjs --project sample-board` is executed from a workspace that contains `skills/html-report/scripts/build-report.mjs`
- **THEN** `report.manifest.json`, `AGENTS.md`, and `projects/sample-board/package.json` use workspace-relative `skills/html-report/scripts/...` commands defaulting to port `3031` and a valid link to `agent-authoring-guide.md`.

#### Scenario: Scaffolding from an externally installed or symlinked skill path
- **WHEN** `scaffold-project.mjs --project external-board` is executed in a workspace where `skills/html-report/` does not exist locally
- **THEN** `report.manifest.json`, `AGENTS.md`, and `projects/external-board/package.json` emit runnable commands and documentation links pointing to the resolved installation path of the skill.
