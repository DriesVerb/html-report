# Tasks: Distinguishable Report Rendering Modes & Server Orchestration

## 1. Canonical Mode Enum & Builder Harmonization

- [x] 1.1 Add canonical 6-mode enum (`print`, `report`, `presentation`, `dashboard`, `working-report`, `live-report`) and alias normalization to `build-report.mjs`, and verify `--mode <mode>` validates inputs
- [x] 1.2 Update `build-report.mjs` to stamp `data-report-mode="<mode>"` on `<html>`, conditionally include mode stylesheets (`@media print`, Impress.js for presentation, Datastar for `live-report`), and verify with test runs

## 2. Dev Server Orchestration & Harness Policy Engine

- [x] 2.1 Implement `MODE_SERVER_POLICIES` in `harness.mjs` ensuring `print` and `report` execute without a server while `dashboard`, `working-report`, and `live-report` launch `serve-report.mjs`, and verify via dry-run assertions
- [x] 2.2 Update `serve-report.mjs` to detect `data-report-mode` from served files and conditionally configure SSE streaming and OpenSpec markdown artifact routing, verifying via curl assertions

## 3. Mode-Adaptive Navbar & Runtime Presentation

- [x] 3.1 Update `template-shell.html` and `report-runtime.js` to render mode-specific badge indicators in the navbar and adjust download menu options (PDF readiness in print mode, live pulse in live/working modes)
- [x] 3.2 Verify visual appearance and responsive layout of mode badges and navbar controls across light and dark themes

## 4. Verification & Playwright Multi-Mode Test Suite

- [x] 4.1 Create automated test suite `tests/report-rendering-modes.test.mjs` validating canonical mode resolution, DOM stamping, and server orchestration policies across all 6 modes
- [x] 4.2 Run test suite via `node --test tests/report-rendering-modes.test.mjs` and verify all tests pass with zero regressions

## 5. Companion Dashboard & Documentation Sync

- [x] 5.1 Re-compile companion `index.html` with completed plan and sync to `implementation-progress.html` on `localhost:3000`
- [x] 5.2 Update `skills/html-report/SKILL.md` and `skills/html-report/references/architecture-and-styling.md` documenting the 6 rendering modes and server rules
