# Proposal: Zero-API-Key Agent Bridge, Clean Error UX & Dynamic Persona Sync

> **Domain:** `Two-Way Agent Bridge` & `Pipeline` | **Beneficiary:** `Hybrid` (`Author + End-User`) | **Two-Axis Classification:** `Server-Connected` + `Interactive / Reactive` | **Journey Companion:** [index.html](index.html)

## Why

During live workshop testing on [`projects/quilt-101/`](../../../projects/quilt-101/index.html), several real-world integration failures surfaced when running the Two-Way AI Assistant without external API keys:

1. **False-positive `gemini` CLI selection & read-only `$HOME/.gemini` (`EROFS`) crash:** [`AgentInferenceRouter._checkProviderAuthenticated("gemini")`](../../../skills/html-report/scripts/preflight.mjs#L333-L338) treats the mere existence of `~/.gemini/` as authenticated, while [`AgentInferenceRouter.dispatch()`](../../../skills/html-report/scripts/preflight.mjs#L533-L606) still spawns `gemini -p ...` even when `authenticated: false`. Inside a sandbox or restricted environment where `~/.gemini` is read-only, `gemini-cli` crashes writing `/home/eta/.gemini/projects.json.*.tmp` (`EROFS`) and dumps an unformatted Node.js stack trace directly into the ⌘K chat dock.
2. **No built-in zero-API-key server assistant mode:** Historically (`pre-a9fa264`), the bridge worked without API keys via `agy` or an internal server responder. Today, users without `GEMINI_API_KEY` / `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` hit `503 inference_unavailable` unless they hand-wire `HTML_REPORT_AI_CMD` (as done ad hoc in [`projects/quilt-101/local-assistant.mjs`](../../../projects/quilt-101/local-assistant.mjs)).
3. **3× prompt duplication:** [`serve-report.mjs`](../../../skills/html-report/scripts/serve-report.mjs#L2171-L2191) pushes the current user turn to `session.history` *before* building `historySnippet`, embeds `User Prompt:` inside `systemPrompt`, and [`preflight.mjs`](../../../skills/html-report/scripts/preflight.mjs#L532) appends `prompt` again—sending the user's message three times.
4. **Persona & port drift:** [`report-runtime.js`](../../../skills/html-report/assets/report-runtime.js#L2842-L2859) does not populate `#agent-dock-persona` from `GET /api/agent/personas` on connect, and when `--port 3031` is occupied, [`serve-report.mjs`](../../../skills/html-report/scripts/serve-report.mjs) falls back to `3034` while static `<meta>` tags still point to `3031`—causing users on `:3031` to hit a different report's `analyst` persona.
5. **Scaffold responsive KPI overflow:** [`scaffold-project.mjs`](../../../skills/html-report/scripts/scaffold-project.mjs) emits DaisyUI `stats-vertical lg:stats-horizontal`, which failed the skill's own [`verify-report.mjs`](../../../skills/html-report/playwright/verify-report.mjs) horizontal-space check at `1024px` (`lg`) with 4 realistic KPIs, and omits `--ai-port` / `--ai-persona` from its suggested rebuild command.

## What Changes

1. **First-Class Zero-API-Key Server Assistant (`--ai-local` / `local-bridge`):**
   - Add an explicit zero-API-key server-backed assistant mode (`--ai-local` on `build-report.mjs` / `serve-report.mjs`, or `HTML_REPORT_AI_MODE=local`, or project-local `local-assistant.mjs`) that connects to `serve-report.mjs` using the full Two-Way Bridge message schema (`GET /api/agent/csrf-token`, `POST /api/agent/prompt`, SSE `datastar-merge-fragments` + `message`, `POST /api/agent/confirm-action`, and `POST /mcp`) with **zero external API keys** and **zero `$HOME` filesystem writes**.
   - Keep `reactive-data-copilot` honesty intact: when neither an authenticated LLM provider nor explicit local/heuristic mode is active, `/api/agent/prompt` still returns `503 inference_unavailable` rather than fabricating LLM output.
2. **Accurate Auth Probing, Sandbox Guard & Sanitized CLI Errors (`preflight.mjs`):**
   - Fix `_checkProviderAuthenticated("gemini")` to inspect actual `gemini-cli` credentials (`GEMINI_API_KEY`, `GOOGLE_GENAI_USE_VERTEXAI`, `GOOGLE_GENAI_USE_GCA`, or auth settings inside `~/.gemini/settings.json`), not bare directory presence.
   - Prevent `dispatch()` from spawning unauthenticated CLIs when `authenticated === false`, and sanitize CLI failures (`EROFS`, missing auth, `ENOENT`, `ETIMEDOUT`) into concise, actionable messages.
3. **Single-Pass Prompt Assembly (`serve-report.mjs` + `preflight.mjs`):**
   - Exclude the active turn from `historySnippet` and avoid repeating `User Prompt:` across `systemPrompt` and `dispatch()`.
4. **Dynamic Persona Sync & Loud Port-Fallback Signaling (`report-runtime.js`, `serve-report.mjs`):**
   - Populate `#agent-dock-persona` from `GET /api/agent/personas` on connect so custom `personas.json` entries always appear and default cleanly.
   - Emit a clear startup warning banner when falling back from an explicitly requested `--port` (e.g., `3031` → `3034`).
5. **Scaffold & Docs Hardening (`scaffold-project.mjs`, `architecture-and-styling.md`):**
   - Switch scaffold KPI row to `grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4`, forward `--ai-port` and `--ai-persona` in rebuild instructions, and document the `<template x-for>` inside `<svg>` restriction.

## Capabilities

### New Capabilities
- None (extends existing `reactive-data-copilot` and `skill-packaging` capabilities).

### Modified Capabilities
- `reactive-data-copilot`: Add explicit zero-API-key server assistant mode (`local-bridge` / `--ai-local`), accurate provider authentication gating, single-pass prompt assembly, sanitized error payloads, and dynamic `#agent-dock-persona` hydration from `/api/agent/personas`.
- `skill-packaging`: Update `scaffold-project.mjs` KPI grid preset to prevent `1024px` (`lg`) horizontal overflow, preserve `--ai-port` / `--ai-persona` in rebuild commands, and emit loud port-fallback notices in `serve-report.mjs`.

## Impact

- **Core Scripts & Runtime:**
  - [`skills/html-report/scripts/preflight.mjs`](../../../skills/html-report/scripts/preflight.mjs)
  - [`skills/html-report/scripts/serve-report.mjs`](../../../skills/html-report/scripts/serve-report.mjs)
  - [`skills/html-report/assets/report-runtime.js`](../../../skills/html-report/assets/report-runtime.js)
  - [`skills/html-report/scripts/scaffold-project.mjs`](../../../skills/html-report/scripts/scaffold-project.mjs)
  - [`skills/html-report/scripts/build-report.mjs`](../../../skills/html-report/scripts/build-report.mjs)
- **Documentation & Tests:**
  - [`skills/html-report/references/architecture-and-styling.md`](../../../skills/html-report/references/architecture-and-styling.md)
  - [`tests/`](../../../tests/) unit & bridge integration tests covering auth detection, prompt deduplication, `EROFS` sanitization, zero-API-key local mode, and persona hydration.
