# Design: Studio Fast Assembly & Smart Scaffolding Pipeline

## Architecture Overview

```
create.html (Studio UI)
  ├── #input-project-slug (optional folder name, independent of heroTitle)
  ├── #btn-scaffold-now ──▶ POST /api/create/scaffold (serve-report.mjs)
  │                             ├── scaffoldProject({ slug, title, widgets, referenceFiles, ... })
  │                             ├── Copies projects/_uploads/* ──▶ projects/<slug>/refs/
  │                             └── Returns { ok, slug, entryUrl, fragmentPath }
  ├── #btn-send-to-agent ──▶ POST /api/agent/prompt (when bridge listener active)
  │
  └── serve-report.mjs (Live Dev Server)
        ├── Watches projects/<slug>/fragment.html (100ms debounce)
        └── Reads report.manifest.json ──▶ buildReport() ──▶ writes index.html ──▶ SSE live reload
```

## Key Technical Decisions

### 1. Independent Project Folder Slug vs. AI Display Title
- `create.html` adds an optional `#input-project-slug` input. When provided, `scaffoldProject()` uses `slugifyProject(projectSlug)` for `projects/<slug>/`; when blank, it falls back to `userGoals || heroTitle || "${target}-project"`.
- Collision guard in `scaffoldProject()`: when called from `/api/create/scaffold` without `force: true`, existing `projects/<slug>/` directories auto-increment (`-2`, `-3`) instead of silently reusing stale `fragment.html` content.

### 2. `fragment.html` Watch & In-Process `buildReport()`
- `serve-report.mjs` checks for a sibling `fragment.html` and `report.manifest.json` when serving any `projects/<slug>/index.html`.
- On `fragment.html` change, it calls `buildReport()` in-process with manifest metadata (`mode`, `theme`, `addons`, `ai`, `pwa`, `title`), avoiding subprocess startup overhead and preserving `<100ms` Assembly.

### 3. Canonical `WIDGET_PRESETS` & CSV/JSON Starter Generation
- `domain-model.mjs` becomes the single source of truth for `DAISYUI_THEMES` (fixing `"lemon"` vs `"lemonade"` drift) and `WIDGET_PRESETS` (`kpi-row`, `chart-pair`, `grid-table`, `mermaid-flow`, `timeline`).
- `scaffoldProject()` accepts `widgets` and `referenceFiles`. For `.csv` and `.json` files in `referenceFiles`, a zero-dependency parser reads headers/keys (first 20 rows) to pre-populate a **Grid.js** table and **Chart.js** dataset in `fragment.html`.

### 4. Two-Speed Verification Boundary (`harness.mjs` vs `preflight.mjs`)
- `preflight.mjs` remains focused on environment readiness (ports `3031`/`3032`, Chrome/Playwright, skill paths).
- `harness.mjs` adds `--fast` (running `lintFragment()`, `autoFixFragment()`, and `buildReport()` in `<100ms` without launching Chromium), while default/full runs keep Playwright browser checks.

## Identified Codebase Gaps Addressed
1. **`create.html` vs `domain-model.mjs` drift:** Align theme list (`lemonade`) and route prompt synthesis through `domain-model.mjs` / `/api/create/synthesize`.
2. **`scaffoldProject()` signature:** Extend with Two-Axis metadata, `widgets`, `referenceFiles`, `refs/` copy, and non-destructive slug collision handling.
3. **Missing `projectSlug` input in `create.html`:** Add `#input-project-slug` independent of `heroTitle`.
4. **Single-file watcher in `serve-report.mjs`:** Extend watcher to `fragment.html` + `report.manifest.json`.
5. **Pre-scaffold bridge dispatch:** Hide **"Send to Agent"** (`#btn-send-to-agent`) unless `/api/agent/preflight` confirms `secureBridge: true` with an authenticated/verified provider and ephemeral CSRF token; harden `/api/agent/prompt`, `/api/agent/confirm-action`, `/api/create/scaffold`, `/__agent_edit__`, and `/api/agent/csrf-token` with loopback, Host, local Origin, and CSRF checks.

## Risks & Mitigations
- **Watch loop (build triggers watch):** Only watch `fragment.html` for rebuilds and write `index.html`; `buildReport()` never writes `fragment.html`, preventing infinite loops.
- **Large CSV/JSON files during scaffold:** Read only the first 64 KB / 20 rows for schema inference so scaffolding stays sub-second.
