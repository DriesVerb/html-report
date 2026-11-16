# Delta Specification: `reactive-data-copilot` (Zero-API-Key Agent Bridge & Clean Error UX)

## ADDED Requirements

### Requirement: Zero-API-Key Local Bridge Assistant Mode
The Two-Way Agent Bridge (`serve-report.mjs` and `build-report.mjs`) SHALL support an explicit zero-API-key server-connected assistant mode (`--ai-local` flag, `HTML_REPORT_AI_MODE=local`, or auto-detected project `local-assistant.mjs` / `HTML_REPORT_AI_CMD`) that answers prompts over the canonical bridge schema (`GET /api/agent/csrf-token`, `POST /api/agent/prompt`, Datastar SSE `datastar-merge-fragments` + `message`, `POST /api/agent/confirm-action`, and `POST /mcp`) without requiring external API keys or writable `$HOME` CLI state directories.

#### Scenario: Running the AI Assistant with zero API keys via local bridge mode
- **WHEN** `serve-report.mjs` is started with `--ai-local` (or `HTML_REPORT_AI_MODE=local` or a project `local-assistant.mjs` script) on a machine with no `GEMINI_API_KEY`, `OPENAI_API_KEY`, or `ANTHROPIC_API_KEY`
- **THEN** `GET /api/agent/preflight` returns `authenticated: true` with `activeProvider: "local-bridge"` (or `"custom-cmd"`), and `POST /api/agent/prompt` returns HTTP `200` with context-grounded Markdown and valid session history without attempting unauthenticated external CLI calls.

### Requirement: Dynamic Dock Persona Hydration from `/api/agent/personas`
The client runtime (`report-runtime.js`) SHALL fetch `GET /api/agent/personas` when connected to the dev server and synchronize `#agent-dock-persona` options so custom personas registered in `personas.json` are selectable and preserved alongside `<meta name="html-report-ai-persona">`.

#### Scenario: Custom persona from `personas.json` appears in the AI dock selector
- **WHEN** a project defines a custom persona (e.g., `"quilting-guide"`) in `personas.json` and connects to `serve-report.mjs`
- **THEN** `#agent-dock-persona` includes the custom persona with its display name and routes outgoing `POST /api/agent/prompt` payloads with that persona ID.

## MODIFIED Requirements

### Requirement: Honest Inference Failure Semantics (No Unflagged Synthetic Analysis)
When no AI inference provider is authenticated/available and neither zero-API-key local bridge mode (`--ai-local` / `HTML_REPORT_AI_MODE=local` / `HTML_REPORT_AI_CMD`) nor `payload.heuristic === true` is active, `/api/agent/prompt` MUST return HTTP `503 Service Unavailable` with a structured, human-readable JSON error payload (`{ status: "error", code: "inference_unavailable", error, reason, preflight }`) without spawning unauthenticated CLI binaries or leaking raw stack traces into the dock UI.

#### Scenario: Unauthenticated Gemini CLI does not crash with raw `EROFS` stack traces
- **WHEN** `gemini` CLI is present on `PATH` without valid credentials (`GEMINI_API_KEY`, Vertex/GCA env, or auth config in `~/.gemini/settings.json`) or when `~/.gemini` is read-only (`EROFS`)
- **THEN** `AgentInferenceRouter` reports `authenticated: false` and returns a concise, sanitized `503` guidance message instead of spawning `gemini` or surfacing raw Node.js stack traces.

#### Scenario: Prompt text is not duplicated in dispatched CLI arguments
- **WHEN** `POST /api/agent/prompt` dispatches a user message to a CLI or HTTP provider
- **THEN** the current turn's `prompt` appears once as the active prompt rather than being repeated across `historySnippet`, `systemPrompt`, and `AgentInferenceRouter.dispatch()`.
