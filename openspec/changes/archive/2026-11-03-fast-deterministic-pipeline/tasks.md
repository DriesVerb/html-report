# Tasks

## 1. Asset Templates & Pre-Bundled Runtime

- [x] 1.1 Create `skills/html-report/assets/template-shell.html` containing the responsive HTML head, DaisyUI navbar, content slot, and centered footer. Verify with a static syntax lint.
- [x] 1.2 Create `skills/html-report/assets/report-runtime.js` containing the canvas-based DaisyUI palette resolver, 32-theme switcher, TOC heading parser, inlined snapshot bundler, and horizontal space detector. Verify with Node syntax execution.
- [x] 1.3 Add automated unit tests in `tests/runtime-assets.test.mjs` verifying theme swatch generation and canvas color resolution without regressions.

## 2. Deterministic Build CLI (`build-report.mjs`)

- [x] 2.1 Implement `skills/html-report/scripts/build-report.mjs` with `--title`, `--content`, `--output`, `--printable`, and `--addons` flags. Verify CLI runs via `--help`.
- [x] 2.2 Add auto-detection logic to scan content fragments for `<canvas>`, `.mermaid`, `data-gridjs`, `katex`, `leaflet`, and `hljs` signatures. Verify with test fragments.
- [x] 2.3 Write automated unit tests in `tests/build-report.test.mjs` verifying slot injection, auto-detection, and explicit addon overrides.

## 3. Lean Playwright Verification (`verify-report.mjs`)

- [x] 3.1 Refactor `skills/html-report/playwright/verify-report.mjs` to dynamically assert only active CDN addons rather than demanding all 11 libraries. Verify with a minimal report.
- [x] 3.2 Add `--quick` mode to test responsiveness at `sm` and `lg` breakpoints without checking all 5 breakpoints. Verify execution finishes in under 5 seconds.
- [x] 3.3 Enforce on-demand single PDF export: skip PDF generation unless `--pdf <file>` is explicitly passed. Verify output.

## 4. Documentation, Skill Guidelines & Learnings

- [x] 4.1 Update `skills/html-report/SKILL.md` to guide agents to emit `<main>` fragments and run `build-report.mjs`. Verify document clarity.
- [x] 4.2 Document canvas 2D OKLCH color resolution and Mermaid numbered list defenses in `references/architecture-and-styling.md` and `references/charts-and-mermaid-style-guide.md`. Verify reference links.
- [x] 4.3 End-to-end integration test: build a test report using `build-report.mjs` and verify it passes `verify-report.mjs --quick`.
