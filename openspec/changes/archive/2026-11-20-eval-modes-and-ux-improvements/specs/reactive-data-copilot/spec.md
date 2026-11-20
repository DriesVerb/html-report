# Delta Specification: reactive-data-copilot

## MODIFIED Requirements

### Requirement: Zero-API-Key Local Bridge Assistant Mode
The Two-Way Agent Bridge (`serve-report.mjs` and `build-report.mjs`) SHALL support an explicit zero-API-key server-connected assistant mode (`--ai-local` flag, `HTML_REPORT_AI_MODE=local`, or auto-detected project `local-assistant.mjs` / `HTML_REPORT_AI_CMD`) that takes precedence over external CLIs when neither an explicit `provider` nor custom `HTML_REPORT_AI_CMD` / `siblingCmd` is supplied, preserves `aiLocal` during `file-watcher.mjs` rebuilds, falls back to `sendLocalBridgeReply()` on provider failure when `localMode` is active, answers prompts over the canonical bridge schema (`GET /api/agent/csrf-token`, `POST /api/agent/prompt`, Datastar SSE `datastar-merge-fragments` + `message`, `POST /api/agent/confirm-action`, and `POST /mcp`) without requiring external API keys or writable `$HOME` CLI state directories, and wraps `.mockup-code` terminal lines inside `DatastarBridge` (`w-full max-w-full`, `whitespace-pre-wrap break-words`).

#### Scenario: Running the AI Assistant with zero API keys via local bridge mode
- **WHEN** `serve-report.mjs` is started with `--ai-local` (or `HTML_REPORT_AI_MODE=local` or a project `local-assistant.mjs` script) on a machine with no `GEMINI_API_KEY`, `OPENAI_API_KEY`, or `ANTHROPIC_API_KEY`
- **THEN** `GET /api/agent/preflight` returns `authenticated: true` with `activeProvider: "local-bridge"` (or `"custom-cmd"`), and `POST /api/agent/prompt` returns HTTP `200` with context-grounded Markdown and valid session history without attempting unauthenticated external CLI calls.

#### Scenario: `--ai-local` takes precedence over an authenticated external CLI when no explicit provider is requested
- **WHEN** `serve-report.mjs` runs with `aiLocal: true` and no explicit `provider` or custom `HTML_REPORT_AI_CMD`
- **THEN** `GET /api/agent/preflight` reports `activeProvider: "local-bridge"` and `localMode: true`, and `POST /api/agent/prompt` responds with `provider: "local-bridge"`.
