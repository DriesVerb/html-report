# Tasks: Modular Documentation Architecture & Minimal DaisyUI Showcase Redesign

## 1. Dedicated Modular Documentation Architecture (`docs/`)

- [x] 1.1 Create `docs/getting-started.md` covering agent prompt install, CLI setup, and quick verification
- [x] 1.2 Create `docs/architecture-fsm.md` covering 10-state deterministic FSM, mechanical auto-fixes, and small-model JSON remediation
- [x] 1.3 Create `docs/cdn-stack.md` detailing the 17-library power stack, SRI hashes, loading guards, and offline bundling
- [x] 1.4 Create `docs/custom-themes.md` covering OKLCH engine, theme inheritance (`extends`), and collapsible studio banner
- [x] 1.5 Create `docs/live-telemetry.md` covering Datastar.js SSE streaming, agent transcript tailing, and morphing
- [x] 1.6 Create `docs/testing-and-verification.md` covering native BDD micro-framework, Playwright 5-breakpoint verification, and horizontal overflow detection
- [x] 1.7 Create `docs/api-and-cli-reference.md` documenting CLI flags, options, and programmatic usage

## 2. Minimalist Standard README (`README.md`)

- [x] 2.1 Rewrite `README.md` adhering to open-source north stars (DaisyUI, Astro, Shadcn) with hero banner, 4 essential badges, 1-click prompt install, 2-step quickstart, and Documentation Hub linking to `docs/`
- [x] 2.2 Verify all markdown links in `README.md` to `docs/*.md` resolve properly

## 3. DaisyUI Minimalist Landing Page Showcase (`index.html`)

- [x] 3.1 Design modern DaisyUI landing page layout with hero, copyable prompt card, value prop cards, and clean visual hierarchy
- [x] 3.2 Implement interactive tabbed Capability Explorer (Data & Visualizations, Architecture Flows, Interactive Tables, Live Telemetry, Formatted Math & Code)
- [x] 3.3 Implement Documentation Hub card grid wired to Showdown markdown viewer modal (`window.openMarkdownViewer`)
- [x] 3.4 Wire theme switching to preserve real-time OKLCH re-theming across Chart.js, Mermaid, and Grid.js
- [x] 3.5 Run `tests/browser-runtime-integrity.test.mjs` to verify zero console/page errors and full 16-CDN global presence

## 4. OpenSpec Companion & Live Dev Server (`localhost:3000`)

- [x] 4.1 Generate companion `index.html` report presenting brainstorm, architecture flows, live journey stepper, and Showdown backlinks
- [x] 4.2 Sync with `implementation-progress.html` and verify live reload on `http://localhost:3000`
