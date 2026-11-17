# deterministic-assembly Delta Specification

> **Change:** `2026-11-16-two-package-core-studio-split` | **Base Spec:** [`openspec/specs/deterministic-assembly/spec.md`](../../../../specs/deterministic-assembly/spec.md)

## MODIFIED Requirements

### Requirement: Pre-Bundled Theme and Runtime Scripts
The default assembled report produced by `packages/core` (`build-report.mjs` / `harness.mjs`) SHALL embed only the viewer-focused `template-shell.html` and slim `report-runtime.js` (32-theme switcher, OKLCH resolution, heading-to-TOC parsing, space detection, Mermaid zoom, Showdown viewer, and download controls), omitting Edit Mode (`#edit-dock`), `#all-settings-modal`, and authoring-only runtime modules unless `--editable` / `editable: true` is explicitly enabled.

#### Scenario: Default compilation produces a clean viewer-only report
- **WHEN** `build-report.mjs` compiles a `<main>` fragment without `--editable` or `--ai`
- **THEN** the assembled HTML includes full 32-theme switching, TOC navigation, Mermaid Enlarge, and Download controls
- **AND** it omits `#edit-dock`, `#all-settings-modal`, `#open-all-settings-btn`, `#settings-publish-toggle`, and authoring/edit-queue JavaScript.

## ADDED Requirements

### Requirement: Opt-In Authoring Plugin Injection Slot
`packages/core` (`template-shell.html` and `build-report.mjs`) SHALL expose explicit authoring injection slots (`<!-- {{AUTHORING_MARKUP}} -->` and `<!-- {{AUTHORING_SCRIPT}} -->`) and an `--editable` / `editable` option so `@html-report/studio` (or live `serve-report` sessions) can inject Edit Mode, element selection, styling overrides, and AI reconnection without baking authoring chrome into static default builds.

#### Scenario: Compiling or serving an editable workspace injects the Studio authoring plugin
- **WHEN** a report is compiled with `--editable` (or served by `packages/studio` in authoring mode)
- **THEN** the authoring dock (`#edit-dock`), `#all-settings-modal`, and `authoring-plugin.js` are injected into the shell slots so Edit Mode and queue workflows operate seamlessly.

### Requirement: Explicit Mirroring Option Instead of Implicit Studio Coupling
`build-report.mjs` SHALL NOT inspect `REPO_ROOT/create.html` to implicitly copy `--project` outputs into `projects/<slug>/`; workspace mirroring SHALL occur only when `--mirror-dir <dir>` (or `mirrorDir`) is explicitly supplied by the caller (such as `scaffold-project.mjs` or Studio server routes).

#### Scenario: Standalone core CLI compilation does not trigger studio mirroring
- **WHEN** `build-report.mjs --project sample` runs from an external directory without `--mirror-dir`
- **THEN** it writes only to the requested `--output` path without probing for `create.html` or writing into an external `projects/` directory.
