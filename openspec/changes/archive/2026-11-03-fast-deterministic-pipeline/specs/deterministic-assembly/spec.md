# Spec Delta

## Purpose
Enables deterministic assembly of HTML reports from body content fragments, reusable asset shells, and modular CDN packages without requiring manual boilerplate synthesis.

## ADDED Requirements

### Requirement: HTML Body Fragment Injection
The builder CLI SHALL accept a semantic `<main>` HTML content fragment and inject it into the pre-generated DaisyUI report shell.

#### Scenario: Successful fragment assembly
- **GIVEN** a content fragment file containing DaisyUI cards and stats
- **WHEN** `node scripts/build-report.mjs --title "Test Report" --content fragment.html --output report.html` is executed
- **THEN** the output HTML contains the full document shell with `<main>` populated by the fragment content.

### Requirement: Dynamic CDN Module Resolution
The builder CLI SHALL automatically detect required CDN libraries from content signatures and support explicit flag overrides.

#### Scenario: Auto-detection of Chart and Mermaid signatures
- **GIVEN** a content fragment containing `<canvas id="perfChart">` and `<pre class="mermaid">`
- **WHEN** the builder CLI processes the fragment without explicit CDN flags
- **THEN** the generated HTML includes Chart.js and Mermaid CDN scripts, while omitting unused libraries like Leaflet and KaTeX.

#### Scenario: Explicit CLI addon override
- **GIVEN** a content fragment without math equations
- **WHEN** the builder CLI is invoked with `--math`
- **THEN** KaTeX CDN scripts and stylesheets are included in `<head>`.

### Requirement: Pre-Bundled Theme and Runtime Scripts
The assembled report SHALL include a static runtime script providing 32-theme switching, heading-to-TOC parsing, and space detection.

#### Scenario: Dynamic theme switching in assembled report
- **WHEN** the user selects any of the 32 DaisyUI themes from the navbar dropdown
- **THEN** the active theme updates on `<html data-theme="...">`, dynamic palettes resolve via canvas 2D context, and active charts/diagrams re-render.
