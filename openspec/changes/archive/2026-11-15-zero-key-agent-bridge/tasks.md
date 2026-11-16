# Tasks: Zero-API-Key Agent Bridge & Clean Error UX

## Phase 1: Auth Gating, Prompt Deduplication & Error Sanitization
- [x] 1.1 Update `_checkProviderAuthenticated("gemini")` and `AgentInferenceRouter.dispatch()` in `skills/html-report/scripts/preflight.mjs` to verify explicit Gemini CLI auth settings and skip unauthenticated CLI spawns.
- [x] 1.2 Add `sanitizeCliError()` in `skills/html-report/scripts/preflight.mjs` so `EROFS`, missing-auth, and timeout errors return concise actionable messages instead of raw stack traces.
- [x] 1.3 Fix 3× prompt duplication in `skills/html-report/scripts/serve-report.mjs` (`historySnippet` before current-turn append; remove duplicate `User Prompt:` from `systemPrompt`).

## Phase 2: Zero-API-Key Local Bridge Mode & Persona Sync
- [x] 2.1 Add `--ai-local` / `HTML_REPORT_AI_MODE=local` and sibling `local-assistant.mjs` auto-detection in `skills/html-report/scripts/serve-report.mjs` and `skills/html-report/scripts/build-report.mjs`.
- [x] 2.2 Hydrate `#agent-dock-persona` dynamically from `GET /api/agent/personas` in `skills/html-report/assets/report-runtime.js` while preserving `html-report-ai-persona`.
- [x] 2.3 Emit explicit port-fallback warning in `skills/html-report/scripts/serve-report.mjs` when a requested `--port` is occupied and expose `requestedPort` in `/api/agent/preflight`.

## Phase 3: Scaffold Hardening, Docs & Verification
- [x] 3.1 Replace `stats-vertical lg:stats-horizontal` with responsive CSS Grid in `skills/html-report/scripts/scaffold-project.mjs` and forward `--ai-port` / `--ai-persona` in rebuild scripts.
- [x] 3.2 Document the `<template x-for>` inside `<svg>` namespace restriction in `skills/html-report/.agents/skills/html-report/references/architecture-and-styling.md` (and `skills/html-report/references/`).
- [x] 3.3 Add unit & integration tests in `tests/` covering unauthenticated `gemini` gating, prompt deduplication, `--ai-local` zero-key responses, persona hydration, and scaffold `lg` responsiveness.
