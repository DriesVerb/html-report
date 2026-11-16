# Proposal: Two-Package Core/Studio Workspace Split & Inverted Clean Runtime (Plan A)

> **Change:** `2026-11-16-two-package-core-studio-split` | **Journey Companion:** [index.html](index.html) | **Design:** [design.md](design.md) | **Tasks:** [tasks.md](tasks.md)

## Why

`html-report` started with a sharp, high-leverage thesis: AI coding agents emit only a semantic `<main id="report-main">` fragment, and local deterministic tooling compiles, themes, and verifies it into a standalone HTML5 deliverable in `<100ms` (~70% token savings).

Over 44 archived OpenSpec changes, the repository accumulated a second full product—a browser-based Creation Studio (`create.html`), live HTTP/SSE workbench (`serve-report.mjs`, 4,663 lines), 11-provider AI inference router (`preflight.mjs`), streamable MCP gateway (`mcp-server.mjs`), in-page Edit Mode with Quill/element selection, and a PWA studio installer—all inside one tangled directory (`skills/html-report/`) and one 6,414-line client script (`report-runtime.js`).

This creates four concrete architectural problems:
1. **Baked-in chrome stripped back out**: Authoring UI (`#edit-dock`, `#all-settings-modal`, AI Bridge) is embedded into every report by default, forcing three overlapping cleanup paths (`build-report.mjs --published`, `publish-report.mjs`, and `HTMLReportPublisher` in `report-runtime.js`) just to emit a clean report.
2. **Compiler coupled to Studio**: `build-report.mjs` checks `fs.existsSync(path.join(REPO_ROOT, "create.html"))` to mirror `--project` outputs into `projects/<slug>/`.
3. **Monolith & root sprawl**: `serve-report.mjs` (4,663 lines) and `report-runtime.js` (6,414 lines) act as catch-all monoliths; `create.html` (4,434 lines) is duplicated identically at repo root and `skills/html-report/assets/create.html`; and root mixes package source with `tmp-pwa-bdd/`, `implementation-progress.html`, root PWA studio manifests, `dev/`, `benchmark/`, `experiments/`, and `research/`.
4. **Offline test fragility**: Running `npm test` offline fails 21 of 613 tests, mostly because Playwright verification hits `net::ERR_INTERNET_DISCONNECTED` on the 17 external CDNs alongside a few non-CDN reconnect/wireframe regressions.

## What Changes

Adopt **Plan A**: keep **one repository** structured as **two zero-dependency npm workspace packages** (`packages/core` and `packages/studio`), preserve root `skills/` symlinks/facades, and invert the runtime so generated reports are clean by default.

1. **Two-Package Workspace Architecture (`packages/core` + `packages/studio`)**:
   - **`packages/core` (`html-report`)**: Deterministic fragment compiler (`build-report.mjs`), FSM harness (`harness.mjs`), OKLCH theme compiler (`theme-compiler.mjs`), PWA builder (`pwa-builder.mjs`, `generate-pwa.mjs`), SemVer compatibility checker (`compatibility.mjs`), caller registry (`caller-registry.mjs`), Playwright verifier (`playwright/verify-report.mjs`), and viewer-only shell/runtime (`template-shell.html`, viewer `report-runtime.js`).
   - **`packages/studio` (`@html-report/studio`)**: Consumes `html-report` strictly via public package exports (`html-report/build`, `html-report/theme`, `html-report/harness`, etc.). Houses `create.html` (single copy), `domain-model.mjs`, `scaffold-project.mjs`, `html-grill.mjs`, `open-create.mjs`, `install-pwa.mjs`, `mcp-server.mjs`, `preflight.mjs`, `datastar-sse.mjs`, `agent-tracker.mjs`, `telemetry-streamer.mjs`, modularized `serve-report` routes, and the opt-in Authoring Plugin.
   - **Root Facade & Symlinks**: Root `package.json` configures `"workspaces": ["packages/*"]` and preserves backward-compatible `"bin"` and `"exports"` forwarding; `skills/html-*` and `.agents/skills/` remain valid skill discovery targets.

2. **Clean-by-Default Runtime + Opt-In Authoring Plugin**:
   - Strip `#edit-dock`, `#all-settings-modal`, AI dock/reconnect chrome, and authoring-only JS out of default `template-shell.html` and viewer `report-runtime.js`.
   - Move Edit Mode, element selection, styling overrides, and AI reconnect into an **Authoring Plugin** (`packages/studio/assets/authoring-plugin.js` + `edit-dock.html`) injected only when served by `serve-report.mjs` or built with `--editable` / `editable: true`.
   - Consolidate `publish-report.mjs` and `--published` into a clean asset-bundle exporter with one canonical source path.

3. **Compiler Decoupling & Server Modularization**:
   - Remove `REPO_ROOT/create.html` detection and implicit `projects/` mirroring from `build-report.mjs`; move project mirroring to an explicit `--mirror-dir` option invoked by `scaffold-project.mjs` / `serve-report.mjs`.
   - Split `serve-report.mjs` into focused server/route modules (`server.mjs`, `routes/static.mjs`, `routes/projects.mjs`, `routes/agent-bridge.mjs`, `routes/mcp.mjs`, `routes/sse.mjs`, `routes/publish.mjs`).

4. **Root Hygiene & Test Partitioning**:
   - Remove duplicate root `create.html` and scratch `tmp-pwa-bdd/`; relocate root Studio PWA assets (`manifest.webmanifest`, `sw.js`, `icon.svg`) into `packages/studio/public/`; organize `dev/`, `benchmark/`, `experiments/`, `research/` cleanly outside package sources.
   - Split tests into offline-safe unit/integration suites (`npm test` / `npm run test:unit`) and CDN-dependent Playwright E2E suites (`npm run test:e2e`), plus a boundary test enforcing zero deep relative imports from `packages/studio` into `packages/core`, while fixing the existing non-CDN test regressions.

## Capabilities

### New Capabilities
- None (architectural restructuring across existing capabilities).

### Modified Capabilities
- [`skill-packaging`](specs/skill-packaging/spec.md): Two-package workspace layout (`packages/core` and `packages/studio`), preserved `skills/` and `.agents/skills/` discovery, root hygiene, and offline unit vs. online E2E test separation.
- [`deterministic-assembly`](specs/deterministic-assembly/spec.md): Clean-by-default shell/viewer runtime, explicit `--editable` authoring plugin injection slot, and removal of implicit `create.html`/`projects/` mirroring from `build-report.mjs`.
- [`publish-clean-export`](specs/publish-clean-export/spec.md): Simplified clean publish pipeline built on clean-by-default output without three redundant DOM strippers.
- [`semantic-versioning`](specs/semantic-versioning/spec.md): Root npm workspace forwarding (`"workspaces": ["packages/*"]`) preserving existing `html-report` CLI bins and subpath exports.

## Impact

- **Repository Layout**: New `packages/core/` and `packages/studio/` workspace packages; root `package.json` updated with `"workspaces"` and compatibility forwarding.
- **Core Pipeline**: `build-report.mjs`, `harness.mjs`, `template-shell.html`, `report-runtime.js`, `verify-report.mjs`.
- **Studio & Server**: `serve-report.mjs` split into modular route files; `create.html` deduplicated; opt-in authoring plugin extracted.
- **Tests**: Boundary enforcement test added; 57 test files partitioned across `packages/core/tests/`, `packages/studio/tests/`, and `tests/e2e/` (CDN-requiring Playwright specs), with existing non-CDN regressions fixed.
