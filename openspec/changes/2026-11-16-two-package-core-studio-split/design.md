# Design: Two-Package Core/Studio Workspace Split & Inverted Clean Runtime (Plan A)

> **Change:** `2026-11-16-two-package-core-studio-split` | **Proposal:** [proposal.md](proposal.md) | **Tasks:** [tasks.md](tasks.md) | **Journey:** [index.html](index.html)

## Architectural Overview

This change separates the repository into two cleanly bounded npm workspace packages inside one git repository while keeping `skills/` and root `package.json` exports/bins backward-compatible:

```text
html-report/
├── package.json                 # npm workspaces root + compatibility bin/exports forwarding
├── skills/                      # Canonical Agent Skill facades (<5KB SKILL.md)
│   ├── html-report/             # -> references packages/core
│   ├── html-print/
│   ├── html-presentation/
│   ├── html-pwa/
│   ├── html-dashboard/          # -> references packages/studio + core
│   └── html-create/             # -> references packages/studio
├── .agents/skills/              # Relative symlinks -> ../../skills/*
├── packages/
│   ├── core/                    # Package 1: "html-report" (compiler, FSM harness, verifier, viewer shell)
│   │   ├── package.json
│   │   ├── assets/
│   │   │   ├── template-shell.html      # Clean viewer-only HTML shell (<!-- {{AUTHORING_HEAD/BODY}} --> slots)
│   │   │   ├── report-runtime.js        # Slim viewer runtime (~1.5-2k lines: themes, TOC, charts, Mermaid zoom, Showdown, download)
│   │   │   └── daisyui-base-themes.json
│   │   ├── scripts/
│   │   │   ├── build-report.mjs         # Pure compiler; no REPO_ROOT/create.html check
│   │   │   ├── harness.mjs
│   │   │   ├── theme-compiler.mjs
│   │   │   ├── pwa-builder.mjs
│   │   │   ├── generate-pwa.mjs
│   │   │   ├── publish-report.mjs       # Asset scanner + deterministic ZIP bundler (no redundant chrome stripping)
│   │   │   ├── compatibility.mjs
│   │   │   └── caller-registry.mjs
│   │   ├── playwright/                  # verify-report.mjs + extensible checks
│   │   └── tests/                       # Offline unit/integration tests for core
│   └── studio/                  # Package 2: "@html-report/studio" (depends on "html-report")
│       ├── package.json
│       ├── assets/
│       │   ├── create.html              # Single canonical Creation Studio HTML
│       │   ├── authoring-plugin.js      # Extracted Edit Mode, selection, styling overrides, AI dock & reconnect
│       │   ├── edit-dock.html           # Authoring dock & all-settings modal markup fragment
│       │   └── mcp_allowlist.json
│       ├── public/                      # Studio PWA root assets (manifest.webmanifest, sw.js, icon.svg)
│       ├── scripts/
│       │   ├── server.mjs               # Modular HTTP server (replaces 4,663-line serve-report.mjs)
│       │   ├── routes/
│       │   │   ├── static.mjs           # Static assets, live-reload SSE, /create, studio PWA manifest
│       │   │   ├── projects.mjs         # Project listing, upload, workspace files, delete
│       │   │   ├── agent-bridge.mjs     # /__agent_status__, /__agent_action__, /__agent_style__, persona registry
│       │   │   ├── mcp.mjs              # Streamable MCP gateway + CSRF + allowlist
│       │   │   ├── sse.mjs              # Datastar SSE streaming & live telemetry
│       │   │   └── publish.mjs          # /api/publish delegating to html-report/publish
│       │   ├── domain-model.mjs
│       │   ├── scaffold-project.mjs     # Explicit project mirroring & workspace generation
│       │   ├── preflight.mjs
│       │   ├── mcp-server.mjs
│       │   ├── datastar-sse.mjs
│       │   ├── agent-tracker.mjs
│       │   ├── telemetry-streamer.mjs
│       │   ├── html-grill.mjs
│       │   ├── open-create.mjs
│       │   ├── open-create.sh
│       │   ├── install-pwa.mjs
│       │   └── install-pwa.sh
│       └── tests/                       # Offline unit/integration tests for studio + boundary tests
├── tests/
│   ├── integration/                     # Cross-package offline integration tests
│   └── e2e/                             # CDN-dependent Playwright browser verification tests
└── docs/                                # Shared documentation & migration guides
```

---

## Key Component Designs

### 1. Strict Package Boundary & Export Contract
- **`packages/core/package.json`** (`"name": "html-report"`):
  - Exports `"."` (`./scripts/harness.mjs`), `"./build"`, `"./harness"`, `"./theme"`, `"./pwa"`, `"./generate-pwa"`, `"./publish"`, `"./compatibility"`, `"./caller-registry"`, `"./verify"`, and `"./assets/*"`.
- **`packages/studio/package.json`** (`"name": "@html-report/studio"`):
  - Declares `"dependencies": { "html-report": "*" }` (resolved via root npm `"workspaces": ["packages/*"]`).
  - Exports `"."` (`./scripts/server.mjs`), `"./serve"`, `"./scaffold"`, `"./domain"`, `"./mcp"`, `"./preflight"`, `"./authoring"`, and `"./assets/create.html"`.
- **Root `package.json`**:
  - Keeps `"name": "html-report-workspace"` (or `"private": true`? Wait: see SemVer requirement in `semantic-versioning/spec.md`: root `package.json` currently declares `"name": "html-report"`, `"bin"`, and `"exports"`).
  - **Preserving SemVer contract**: Keep root `package.json` as `"name": "html-report"` with `"workspaces": ["packages/*"]` (or name core `"@html-report/core"` while root `"html-report"` re-exports both `packages/core` and `packages/studio`!).
  - *Crucial distinction*: If root `package.json` keeps `"name": "html-report"`, workspace packages must have distinct names (`"@html-report/core"` and `"@html-report/studio"`), because npm workspaces forbid two `package.json` files sharing the same `"name"`. Root `package.json` forwards `"./build"`, `"./harness"`, `"./theme"`, `"./pwa"`, `"./publish"`, `"./compatibility"` → `./packages/core/...`, and `"./serve"`, `"./scaffold"` → `./packages/studio/...`.
  - `@html-report/studio` imports `@html-report/core` exclusively via `@html-report/core/...` subpath exports (never `../../core/...`), verified by an automated AST/grep boundary test.

### 2. Inverting the Client Runtime (Clean by Default, Opt-In Authoring)
Currently, `template-shell.html` embeds `#edit-dock`, `#all-settings-modal`, `#open-all-settings-btn`, and `#settings-publish-toggle`, and `report-runtime.js` (6,414 lines) ships `HTMLReportEdit`, `HTMLReportAgent`, and `HTMLReportPublisher` inside every compiled report—then strips them back out in three places (`build-report.mjs --published`, `publish-report.mjs`, and `HTMLReportPublisher.stripAuthoringElements()`).

**New design:**
1. **`packages/core/assets/template-shell.html`** contains only:
   - Sticky navbar (title, `Contents` TOC dropdown, Settings gear with **Appearance** 32-theme switcher + custom OKLCH studio link if present, and **Download** HTML/PDF).
   - Print cover (`#print-cover-page`), Mermaid Enlarge modal (`#mermaid-enlarge-modal`), Showdown Markdown Viewer modal, and Reveal.js / Datastar hooks.
   - Explicit injection placeholders: `<!-- {{AUTHORING_MARKUP}} -->` and `<!-- {{AUTHORING_SCRIPT}} -->` (empty by default).
2. **`packages/core/assets/report-runtime.js`** retains only viewer capabilities:
   - Theme switching & OKLCH runtime resolution, Canvas/Chart.js & Mermaid re-rendering, TOC builder, Mermaid Enlarge modal, Showdown viewer, `buildInlinedHtmlSnapshot()` (no longer needing to strip authoring dock/modals/AI buttons because they aren't there in default builds), and offline `file://` board fallback.
3. **`packages/studio/assets/authoring-plugin.js` + `edit-dock.html`**:
   - Encapsulates `HTMLReportEdit` (bottom-docked queue, element selection, styling overrides, deterministic prompt generation), `HTMLReportAgent` (Two-Way AI dock, heartbeat reconnect, turnkey reconnection modal), `#all-settings-modal`, and `#settings-publish-toggle`.
   - **Injection points**:
     - `packages/core`'s `buildReport({ ..., editable: true, authoringPlugin })` (or `--editable` CLI flag resolving `@html-report/studio/authoring` when installed) injects `edit-dock.html` + `authoring-plugin.js` into the placeholders.
     - `packages/studio`'s `serve-report` server injects the authoring plugin live when serving editable project workspaces (or `--editable` mode) and omits it cleanly on `/api/publish` or `publish-report.mjs`.
   - **Published export**: Because `publish-report.mjs` builds from `fragment.html` with `editable: false` (default), published exports are inherently clean—eliminating HTML comment-marker regex stripping in `build-report.mjs` and DOM pruning hacks in `report-runtime.js` (keeping only a tiny legacy compatibility helper if an older HTML file is passed to `HTMLReportPublisher`).

### 3. Decoupling `build-report.mjs` from Studio Workspaces
- Remove the `fs.existsSync(path.join(REPO_ROOT, "create.html"))` branch from `packages/core/scripts/build-report.mjs` (lines 1493–1515).
- Replace with an explicit optional `mirrorDir` / `--mirror-dir <dir>` parameter (unused by standalone CLI skill runs; passed explicitly by `scaffold-project.mjs` or `studio` routes when workspace mirroring is desired).
- Keep `compatibility.mjs` `getPackageMetadata()` resolving the workspace root or core package cleanly.

### 4. Modularizing `serve-report.mjs` (4,663 lines → ~300-line entry + focused modules)
Split `serve-report.mjs` inside `packages/studio/scripts/` while exporting the same public API (`startServer`, `serveReport`, `PersonaRegistry`) from `packages/studio/scripts/server.mjs` (and re-exporting via a thin `serve-report.mjs` shim if needed):
- `routes/static.mjs`: Static file resolution, `create.html` / `/create` routing, studio `manifest.webmanifest`, live-reload injection + SSE, `fragment.html` watcher auto-rebuild.
- `routes/projects.mjs`: `/api/projects`, `/api/create/scaffold`, `/api/create/upload`, `/api/create/workspace-files`, live project delete.
- `routes/agent-bridge.mjs`: `PersonaRegistry`, `/__agent_status__`, `/__agent_action__`, `/__agent_style__`, `/api/agent/preflight`, `/api/agent/csrf-token`.
- `routes/mcp.mjs`: `/mcp` streamable HTTP JSON-RPC + CSRF + allowlist forwarding to `mcp-server.mjs`.
- `routes/sse.mjs`: Datastar SSE streams (`/events`, `/api/board/state`, telemetry feeds).
- `routes/publish.mjs`: `/api/publish` delegating to `@html-report/core/publish`.

### 5. Root Hygiene & Skill Entrypoints
- Keep `skills/html-report/`, `skills/html-print/`, `skills/html-presentation/`, `skills/html-pwa/`, `skills/html-dashboard/`, `skills/html-create/` as thin Agent Skill facades (`SKILL.md` `<5KB`, `references/`, `examples/`), with thin CLI wrapper scripts (or updated commands) pointing to `packages/core/scripts/...` and `packages/studio/scripts/...`.
- Delete duplicated root `create.html` and leftover `tmp-pwa-bdd/`.
- Move Studio PWA files (`manifest.webmanifest`, `sw.js`, `icon.svg`) into `packages/studio/public/` and update `install-pwa.mjs` / `routes/static.mjs` to serve them from there.
- Relocate `dev/`, `benchmark/`, `experiments/`, `research/` under `examples/` or `docs/research/` (or keep clearly separated from `packages/*`) so package boundaries are unmistakable.

### 6. Test Partitioning & Fixing Existing Offline Failures
- Organize tests by ownership:
  - `packages/core/tests/*.test.mjs`: Core compiler, theme compiler, PWA builder, compatibility, harness FSM, static lint, publish zip/asset bundling.
  - `packages/studio/tests/*.test.mjs`: Server routes, MCP, AI bridge, Datastar SSE, scaffolding, grill, authoring plugin, **plus** a package-boundary lint test verifying `@html-report/studio` never deep-imports `@html-report/core` internals and `@html-report/core` never imports `@html-report/studio`.
  - `tests/e2e/*.test.mjs`: Playwright browser suites that fetch live CDNs (Tailwind, DaisyUI, Chart.js, etc.).
- Update root `package.json` scripts:
  - `npm test` / `npm run test:unit`: Runs offline-safe core + studio + integration tests (100% green offline).
  - `npm run test:e2e`: Runs CDN-dependent Playwright E2E tests (and documents network requirement).
- Fix the existing non-CDN failures observed in the baseline run (`tests/agent-reconnect.test.mjs`, `tests/agent-reconnect.bdd.test.mjs`, `tests/experience-review-remediations.test.mjs`, `tests/html-create.bdd.test.mjs`).
