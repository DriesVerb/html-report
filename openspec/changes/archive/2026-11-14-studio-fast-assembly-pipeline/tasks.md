# Tasks: Studio Fast Assembly & Smart Scaffolding Pipeline

## Phase 1: Instant Scaffolding & Live Fragment Rebuild
- [x] 1.1 Add optional `#input-project-slug` field and **"Scaffold Now"** button in `skills/html-report/assets/create.html` (and sync `create.html`)
- [x] 1.2 Extend `scaffoldProject()` in `skills/html-report/scripts/scaffold-project.mjs` with non-destructive slug collision handling (`-2`, `-3`), `referenceFiles` support, and `projects/<slug>/refs/` staging
- [x] 1.3 Add `POST /api/create/scaffold` endpoint in `skills/html-report/scripts/serve-report.mjs`
- [x] 1.4 Add `fragment.html` + `report.manifest.json` file watcher in `serve-report.mjs` to auto-run `buildReport()` on save

## Phase 2: Token-Saving Smart Scaffolding & Domain Alignment
- [x] 2.1 Align `DAISYUI_THEMES` (`lemonade`) and define `WIDGET_PRESETS` in `skills/html-report/scripts/domain-model.mjs`
- [x] 2.2 Add `--widgets` support to `scaffold-project.mjs` (`generateStarterFragment()`) and expose preset selector in `create.html`
- [x] 2.3 Add zero-dependency CSV/JSON header/key introspection in `scaffold-project.mjs` to pre-wire Chart.js and Grid.js starters

## Phase 3: Two-Speed Verification & Direct Bridge Dispatch
- [x] 3.1 Add `--fast` static-only verification mode (`lintFragment()` + `buildReport()`) to `skills/html-report/scripts/harness.mjs`
- [x] 3.2 Hide **"Send to Agent"** in `create.html` unless `/api/agent/preflight` verifies a secure, authenticated two-way bridge, and enforce loopback + local Origin + ephemeral CSRF tokens across bridge endpoints in `serve-report.mjs`
- [x] 3.3 Add unit & Playwright integration tests for `/api/create/scaffold`, `fragment.html` auto-rebuild, `--widgets`, CSV/JSON starters, `--fast` verification, and two-way bridge security guardrails
