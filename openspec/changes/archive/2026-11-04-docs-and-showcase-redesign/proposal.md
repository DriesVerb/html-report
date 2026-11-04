# Proposal: Modular Documentation Architecture & Minimal DaisyUI Showcase Redesign

## Why

The current `README.md` and GitHub Pages showcase (`https://driesverb.github.io/html-report/`) suffer from extreme information overload. `README.md` is an uncurated 370-line dump of ASCII diagrams, massive 17-CDN version tables, and internal harness state machine code blocks. Simultaneously, `index.html` (3,766 lines) acts as a monolithic "visual bomb" that forces visitors to scroll through dozens of disparate charts, maps, calendars, and LaTeX equations all at once.

To establish `html-report` as a top-tier, publication-grade tool for the agent ecosystem, we need a clean, scannable presentation inspired by modern open-source north stars like `daisyui.com`, `tailwindcss.com`, and `shadcn/ui`. We must separate quick onboarding from deep architectural reference by introducing a dedicated `docs/` directory, condensing the root `README.md` into an elegant, scannable guide, and transforming GitHub Pages into an aesthetic, interactive, tabbed showcase landing page with zero visual chaos.

## What Changes

- **Create Dedicated Modular Documentation (`docs/`)**:
  - `docs/getting-started.md`: Installation via 1-click agent prompt, universal symlinks, and CLI.
  - `docs/architecture-fsm.md`: Deep dive on the 10-state deterministic FSM harness, <1ms pre-flight auto-fixes, and small-model remediation directives.
  - `docs/cdn-stack.md`: Complete 17-library catalog, version matrices, SRI hashes, loading guards, and offline bundling.
  - `docs/custom-themes.md`: Custom DaisyUI OKLCH engine, theme inheritance (`extends`), and collapsible studio banner.
  - `docs/live-telemetry.md`: Real-time SSE streaming with Datastar.js, transcript tailing (`agy`, `claude-code`, `codex`), and hypermedia morphing.
  - `docs/testing-and-verification.md`: Zero-framework native BDD harness, Playwright 5-breakpoint verification, and horizontal scrollbar detection.
  - `docs/api-and-cli-reference.md`: Comprehensive CLI flags (`build-report.mjs`, `harness.mjs`, `serve-report.mjs`) and programmatic API usage.

- **Overhaul `README.md` to Minimalist North-Star Standards**:
  - Crisp hero banner with punchy elevator pitch.
  - Minimalist badge strip (only 4 essential badges: License, LLM-Agnostic, 17 CDNs, Tests Passing).
  - Frictionless 1-click agent prompt copy box & 1-line CLI install.
  - Punchy "Why `html-report`?" comparison and concise ASCII pipeline diagram.
  - 2-step Quickstart guide (Write Fragment -> Run Harness -> Done).
  - Clean Documentation Hub index with direct links to all `docs/*.md` guides.
  - Live showcase link with clear call to action.

- **Redesign GitHub Pages Showcase (`index.html`) to DaisyUI North-Star Minimalist Aesthetic**:
  - Replaces the 3,766-line vertical visual dump with a sleek, clean, modern landing page.
  - **Hero Section**: Modern title, subheader, 1-click prompt install card with copy button, and "Get Started" / "Explore Capabilities" buttons.
  - **Value Proposition Grid**: Clean, spacious DaisyUI cards highlighting speed (<100ms), 32 themes, 17 non-blocking CDNs, cryptographic security, and Playwright verification.
  - **Interactive Capability Explorer**: Clean, modern tabbed interface (Data Visualizations, Architecture Flows, Interactive Tables, Live Telemetry, Formatted Math & Code) that lets visitors interactively test each CDN library without visual chaos.
  - **Documentation Hub**: Grid of cards linking directly to the markdown docs in `docs/` with 1-click Showdown modal preview or direct view.
  - **Dedicated Demo Links**: Direct buttons to standalone deep-dive reports and live dashboards.
  - Full adherence to 16/17 CDN parity and zero console errors (`tests/browser-runtime-integrity.test.mjs` verification).

- **Update Feature Companion & Dev Server**:
  - Create companion `openspec/changes/docs-and-showcase-redesign/index.html` with Journey Stepper, live task progress, and Showdown backlinks.
  - Sync with `implementation-progress.html` on `http://localhost:3000`.

## Capabilities

### New Capabilities
- `modular-documentation-and-showcase`: Modular root-level `docs/` architecture, minimalist standard `README.md`, and aesthetic DaisyUI tabbed landing page showcase at repo root (`index.html`).

### Modified Capabilities
- None.

## Impact

- `README.md`: Drastically shortened, scannable, and modern.
- `docs/`: 7 new structured deep-dive markdown guides.
- `index.html`: Complete redesign to a clean landing page with tabbed capability explorer.
- Tests: `tests/browser-runtime-integrity.test.mjs` continues to pass with 0 console errors and full CDN global verification.
