# Spec Delta: modular-documentation-and-showcase

## Purpose

Aligns `README.md` and the GitHub Pages showcase (`index.html`) around **agentic ease of use** (1-prompt install, 3-step fragment-to-verified-report loop, 5 specialized deliverable skills) while presenting `html-studio` (`/html-studio`) as a **bonus interactive companion** with a live browser entrypoint (`studio.html` / `packages/studio/assets/create.html`).

## MODIFIED Requirements

### Requirement: Minimal Scannable Standard README
The root `README.md` SHALL remain concise (`<= 200` lines), lead with 1-prompt agent installation and the 3-step agentic loop, summarize the 5 deliverable skills (`/html-report`, `/html-dashboard`, `/html-presentation`, `/html-print`, `/html-pwa`), highlight `html-studio` as a bonus companion linking to live GitHub Pages (`studio.html`), preserve SemVer badges and migration links, and index all guides in `docs/`.

#### Scenario: Inspecting root README layout and documentation links
- **WHEN** a user reads `README.md`
- **THEN** it is `<= 200` lines, provides copyable agent install commands, demonstrates the 3-step agentic workflow and 5 deliverable skills, links to the bonus live `html-studio` on GitHub Pages, includes SemVer badges/links, and links to all `docs/*.md` guides

### Requirement: Minimalist Aesthetic Landing Page Showcase
The GitHub Pages entrypoint (`index.html`) SHALL briefly explain the core agentic concept, showcase the interactive features via the tabbed Capability Explorer, present `html-studio` as a bonus companion with direct links to `packages/studio/assets/create.html` and `studio.html`, and wire the Documentation Hub to the built-in Showdown markdown viewer modal.

#### Scenario: Loading GitHub Pages index.html showcase
- **WHEN** a visitor loads `index.html` in a web browser
- **THEN** the page renders with zero console errors, explains the 3-step agentic concept, exposes direct links to the live `html-studio`, and provides full 16-CDN runtime integrity

#### Scenario: Launching live html-studio from GitHub Pages
- **WHEN** a visitor clicks the bonus `html-studio` CTA on `index.html` or opens `studio.html`
- **THEN** they navigate directly to the live static `packages/studio/assets/create.html` Creation Studio
