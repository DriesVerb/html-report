# Design: Agentic Ease of Use README & GitHub Pages Showcase with Bonus HTML Studio

## Overview

This change aligns the public entrypoints (`README.md` and `index.html`) with how developers and AI coding agents actually adopt and use `html-report`:

1. **Primary Narrative — Agentic Ease of Use**:
   - Install in 1 agent prompt (or 1 terminal line).
   - Agent emits **only** the `<main>` semantic fragment (~70% token reduction).
   - Harness compiles and verifies in `<100ms` (`harness.mjs` / `build-report.mjs`).
   - Live dev server (`serve-report.mjs`) provides zero-reload hot swapping and Two-Way Visual Edit Mode.
   - 5 specialized deliverable skills (`/html-report`, `/html-dashboard`, `/html-presentation`, `/html-print`, `/html-pwa`).
2. **Bonus Narrative — Interactive `html-studio`**:
   - Positioned explicitly as a **Bonus Companion** (`@html-report/studio`) that runs completely client-side with zero Node.js required.
   - Accessible from GitHub Pages via both `https://driesverb.github.io/html-report/studio.html` and direct `./packages/studio/assets/create.html`.

## Key Technical Decisions

### 1. Built-In Showdown Markdown Viewer in Core Runtime
- Placing `openMarkdownViewer` / `closeMarkdownViewer` in `packages/core/assets/runtime/05-cdn-hydrators.js` guarantees that `autoLinkMarkdownFiles()` links and Documentation Hub buttons work automatically in every generated report (including `index.html` and `implementation-progress.html`).
- Uses `window.openMarkdownViewer = window.openMarkdownViewer || openMarkdownViewer` in `08-publisher-and-board.js` so fragments with custom viewers are never clobbered.
- Resolves content from `window.MARKDOWN_ARTIFACTS`, `window.OPEN_SPEC_ARTIFACTS`, `<script id="markdown-artifacts-data">`, `<script id="open-spec-artifacts-data">`, or `fetch()` over HTTP/HTTPS, with a clean `file://` fallback.

### 2. Static GitHub Pages Compatibility for `html-studio`
- `packages/studio/assets/create.html` references `./manifest.webmanifest`, `./icon.svg`, and `./create-studio/01..06.js`.
- Copying `manifest.webmanifest`, `icon.svg`, and `sw.js` from `packages/studio/public/` into `packages/studio/assets/` ensures zero 404s when served directly from GitHub Pages.
- Root `studio.html` acts as a friendly vanity entrypoint (`https://driesverb.github.io/html-report/studio.html`) redirecting immediately to `./packages/studio/assets/create.html` while preserving query params and hashes.

### 3. Backward Compatibility with Existing Tests
- `README.md` stays `<= 200` lines (132 lines), preserving the `Install the html-report skill` prompt, SemVer badges/section, `MIGRATION.md`, and all 7+ `docs/*.md` links.
- `index.html` preserves `#hero-headline` (`"Publication-Grade HTML5 Reports"`), all 7 `#tab-btn-*` / `#tab-panel-*` explorer elements, and full CDN global parity with zero console errors under headless Chromium `file://`.
