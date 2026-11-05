# Tasks: Instant Progressive Web App (PWA) Generation

> Companion Dashboard: [index.html](file:///home/eta/projects/html-report/openspec/changes/instant-pwa/index.html) | Servable at `http://localhost:3000`
> Backlinks: [proposal.md](file:///home/eta/projects/html-report/openspec/changes/instant-pwa/proposal.md) | [design.md](file:///home/eta/projects/html-report/openspec/changes/instant-pwa/design.md) | [specs/instant-pwa/spec.md](file:///home/eta/projects/html-report/openspec/changes/instant-pwa/specs/instant-pwa/spec.md)

## Phase 1: Planning & OpenSpec Foundation
- [x] 1.1 Create OpenSpec change directory, proposal, design, and delta spec
- [x] 1.2 Design PWA architecture (manifest, service worker caching, theme sync, install prompt)
- [x] 1.3 Generate companion `index.html` journey dashboard and sync to `implementation-progress.html`

## Phase 2: Core PWA Engine & Standalone Converter Tool
- [x] 2.1 Implement `skills/html-report/scripts/pwa-builder.mjs` (manifest, service worker, icons, HTML injector)
- [x] 2.2 Implement `skills/html-report/scripts/generate-pwa.mjs` CLI to transform any existing HTML report into a PWA
- [x] 2.3 Verify asset outputs (valid JSON manifest, valid service worker syntax, scalable SVG icons)

## Phase 3: Integration into Pipeline, Shell & Runtime
- [x] 3.1 Update `skills/html-report/scripts/build-report.mjs` with `--pwa` flag and `pwa` canonical mode
- [x] 3.2 Update `skills/html-report/scripts/harness.mjs` with `--pwa` flag and server orchestration policy
- [x] 3.3 Update `skills/html-report/scripts/serve-report.mjs` with `.webmanifest` MIME type and `sw.js` headers
- [x] 3.4 Update `skills/html-report/assets/template-shell.html` with install button, offline badge, and meta slots
- [x] 3.5 Update `skills/html-report/assets/report-runtime.js` with SW registration, theme-color sync, and `beforeinstallprompt`

## Phase 4: Verification & Automated Test Suites
- [x] 4.1 Write comprehensive unit tests in `tests/pwa.test.mjs`
- [x] 4.2 Write native BDD tests in `tests/pwa.bdd.test.mjs` bound to `specs/instant-pwa/spec.md`
- [x] 4.3 Run full test suite with `node --test tests/*.test.mjs` ensuring 100% pass rate

## Phase 5: Skill Documentation & Reference Guide
- [x] 5.1 Create `skills/html-report/references/instant-pwa-guide.md`
- [x] 5.2 Update `skills/html-report/SKILL.md` with explicit PWA triggers ("I want to create a pwa") and instructions
- [x] 5.3 Update root documentation in `docs/` and `README.md`

## Phase 6: Companion Dashboard Finalization & Archival Readiness
- [x] 6.1 Update `tasks.md` and feature `fragment.html` to reflect complete implementation
- [x] 6.2 Rebuild `openspec/changes/instant-pwa/index.html` and mirror to `implementation-progress.html`
- [x] 6.3 Verify live dev server at `http://localhost:3000`
