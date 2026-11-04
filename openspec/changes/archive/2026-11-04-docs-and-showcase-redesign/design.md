# Design: Modular Documentation Architecture & Minimal DaisyUI Showcase Redesign

## Context

See [proposal.md](proposal.md) for the motivation. Currently, `README.md` attempts to be an installation guide, architecture specification, benchmark dashboard, and API manual simultaneously. At the same time, `index.html` (hosted on GitHub Pages) renders thousands of lines of stacked charts, diagrams, tables, and formula blocks sequentially, overwhelming first-time visitors.

This design introduces a modular documentation architecture in `docs/`, condenses `README.md` into an open-source standard landing document, and redesigns `index.html` into a DaisyUI-powered interactive landing page with a tabbed capability explorer.

## Goals / Non-Goals

**Goals:**
- Create a dedicated, well-structured `docs/` directory containing 7 modular guides for onboarding, FSM architecture, CDN catalog, custom themes, real-time telemetry, verification, and CLI reference.
- Restructure `README.md` into a scannable, modern document adhering to open-source best practices (daisyUI, Astro, Shadcn).
- Redesign `index.html` into an aesthetic, minimalist landing page featuring a hero banner, 1-click install card, key value proposition cards, an interactive tabbed capability explorer, and a documentation hub with Showdown modal viewer integration.
- Preserve 100% test compatibility: `tests/browser-runtime-integrity.test.mjs` must load `index.html` with zero console/page errors and verify all 16 CDN globals.

**Non-Goals:**
- Altering the underlying CLI tools (`build-report.mjs`, `harness.mjs`, `serve-report.mjs`) or core runtime behavior.
- Replacing the 17-library CDN stack or dropping any supported capability.

## Decisions

### 1. Dedicated `docs/` Directory Structure
- **Decision**: Move in-depth technical details from `README.md` into dedicated markdown files in `docs/`:
  - `docs/getting-started.md`
  - `docs/architecture-fsm.md`
  - `docs/cdn-stack.md`
  - `docs/custom-themes.md`
  - `docs/live-telemetry.md`
  - `docs/testing-and-verification.md`
  - `docs/api-and-cli-reference.md`
- **Rationale**: Keeps `README.md` under 150 lines, focused on value proposition, quick install, and rapid onboarding. Developers and agents can navigate directly to specific topic guides as needed.

### 2. Tabbed Interactive Capability Explorer for GitHub Pages (`index.html`)
- **Decision**: Replace the vertical 3,800-line stack with a modern DaisyUI tabbed component explorer:
  - Tab 1: **Data & Visualizations** (Chart.js multi-dataset canvas with theme sync)
  - Tab 2: **Architecture & Flows** (Mermaid sequence and flow diagrams)
  - Tab 3: **Interactive Tables** (Grid.js sortable, searchable table)
  - Tab 4: **Live LLM Telemetry** (Datastar streaming simulation drawer)
  - Tab 5: **Rich Math & Code** (KaTeX LaTeX equations + Highlight.js code formatting)
- **Rationale**: Gives visitors immediate, interactive proof of all capabilities in a compact, viewport-friendly layout without "visual bomb" cognitive overload.

### 3. Integrated Showdown Markdown Viewer for Documentation Cards
- **Decision**: In `index.html`, render a Documentation Hub grid where each card links to a `docs/*.md` file. Clicking a card opens the document in the built-in Showdown markdown modal viewer (`window.openMarkdownViewer('docs/...')`) with tabbed source preview and print capability.
- **Rationale**: Allows visitors on GitHub Pages to read comprehensive documentation without navigating away or dealing with raw GitHub markdown rendering.

### 4. Preservation of 16-CDN Global Parity & Browser Runtime Integrity
- **Decision**: Keep all 16 CDN library imports and sample initializers in `index.html`, mounting them inside the interactive tab panels.
- **Rationale**: Ensures `tests/browser-runtime-integrity.test.mjs` passes identically while demonstrating that all 17 libraries co-exist cleanly without conflicts.

## Risks / Trade-offs

- **[Risk] Lazy initialization in tabs could cause hidden canvas or map rendering sizing bugs.**  
  → *Mitigation*: Ensure Chart.js and Leaflet invalidate/resize upon tab switch using Alpine.js or native tab change listeners (`chart.resize()`, `map.invalidateSize()`).
- **[Risk] Broken relative links between `README.md`, `docs/`, and GitHub Pages.**  
  → *Mitigation*: Use standard relative paths (`docs/getting-started.md`) that work seamlessly on both GitHub's web interface and local clones.
