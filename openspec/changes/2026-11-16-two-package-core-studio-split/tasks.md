# Tasks: Two-Package Core/Studio Workspace Split & Inverted Clean Runtime (Plan A)

> **Companion Dashboard:** [index.html](index.html) | **Proposal:** [proposal.md](proposal.md) | **Design:** [design.md](design.md) | **Delta Specs:** [skill-packaging](specs/skill-packaging/spec.md) · [deterministic-assembly](specs/deterministic-assembly/spec.md) · [publish-clean-export](specs/publish-clean-export/spec.md) · [semantic-versioning](specs/semantic-versioning/spec.md)

## Phase 1: Workspace Scaffold & Boundary Enforcement

- [x] 1.1 Configure npm `"workspaces": ["packages/*"]` in root `package.json` while keeping root `"name": "html-report"`, `"bin"`, and `"exports"` forwarding cleanly to `@html-report/core` and `@html-report/studio`.
- [x] 1.2 Create `packages/core/package.json` (`"@html-report/core"`) with subpath exports (`./build`, `./harness`, `./theme`, `./pwa`, `./generate-pwa`, `./publish`, `./compatibility`, `./caller-registry`, `./verify`) and `packages/studio/package.json` (`"@html-report/studio"`) depending on `"@html-report/core": "*"`.
- [x] 1.3 Add an automated boundary test ensuring `@html-report/core` has zero imports from `@html-report/studio` and `@html-report/studio` imports `@html-report/core` exclusively via public subpath exports.

## Phase 2: Core Compiler & Clean-by-Default Runtime (`packages/core`)

- [x] 2.1 Move core scripts (`build-report.mjs`, `harness.mjs`, `theme-compiler.mjs`, `pwa-builder.mjs`, `generate-pwa.mjs`, `publish-report.mjs`, `compatibility.mjs`, `caller-registry.mjs`), `playwright/`, and core `assets/` into `packages/core/`.
- [x] 2.2 Remove `REPO_ROOT/create.html` detection and implicit `projects/` mirroring from `build-report.mjs`, replacing it with an explicit `--mirror-dir` / `mirrorDir` option.
- [x] 2.3 Refactor `template-shell.html` and `report-runtime.js` in `packages/core/assets/` to be viewer-only by default, exposing `<!-- {{AUTHORING_MARKUP}} -->` and `<!-- {{AUTHORING_SCRIPT}} -->` injection slots and an opt-in `--editable` / `editable` build hook.
- [x] 2.4 Simplify `publish-report.mjs` and `build-report.mjs` around clean-by-default output (removing redundant HTML authoring comment-marker stripping while preserving `HTMLReportPublisher` fallback compatibility if needed).

## Phase 3: Studio Package, Authoring Plugin & Server Modularization (`packages/studio`)

- [x] 3.1 Move Studio & workbench files (`create.html`, `domain-model.mjs`, `scaffold-project.mjs`, `preflight.mjs`, `mcp-server.mjs`, `datastar-sse.mjs`, `agent-tracker.mjs`, `telemetry-streamer.mjs`, `html-grill.mjs`, `open-create.*`, `install-pwa.*`, `mcp_allowlist.json`) into `packages/studio/` and update imports to `@html-report/core/*`.
- [x] 3.2 Extract Edit Mode, element selection, styling overrides, `#all-settings-modal`, `HTMLReportEdit`, and `HTMLReportAgent` into `packages/studio/assets/authoring-plugin.js` + `edit-dock.html` and wire live/opt-in injection into `serve-report` and `--editable`.
- [x] 3.3 Split the 4,663-line `serve-report.mjs` into `packages/studio/scripts/server.mjs` and focused `routes/{static,projects,agent-bridge,mcp,sse,publish}.mjs` modules while preserving `startServer` / `serveReport` / `PersonaRegistry` exports.

## Phase 4: Skill Facades, Root Hygiene & Test Partitioning

- [x] 4.1 Update `skills/html-*` `SKILL.md` commands and thin CLI shims (plus `.agents/skills/` symlinks and `skill-router.mjs`) so all 6 modular skills resolve seamlessly against `packages/core` and `packages/studio`.
- [x] 4.2 Delete duplicate root `create.html` and leftover `tmp-pwa-bdd/`; relocate root Studio PWA files (`manifest.webmanifest`, `sw.js`, `icon.svg`) into `packages/studio/public/` and organize non-package `dev/`, `benchmark/`, `experiments/`, `research/` directories cleanly.
- [x] 4.3 Partition tests into offline unit/integration (`npm test` / `npm run test:unit` — 578/578 passing offline) vs. CDN-dependent Playwright E2E (`npm run test:e2e` — 26/42 passing offline; 16 CDN assertions require network access), fix the non-CDN test failures (`agent-reconnect`, `experience-review-remediations`, `html-create.bdd`), and verify clean offline unit pass.
