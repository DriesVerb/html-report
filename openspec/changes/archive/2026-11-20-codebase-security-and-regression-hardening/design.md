# Design: Codebase Security & Regression Hardening

> **Change:** `codebase-security-and-regression-hardening` | **Proposal:** [proposal.md](proposal.md) | **Tasks:** [tasks.md](tasks.md) | **Delta Specs:** [specs/](specs/security-and-regression-hardening/spec.md)

## Architecture & Security Controls

### 1. Core Fragment Sanitization & Assembly (`@html-report/core`)
- **`fetchFeedSnapshotSync(url)`**: Parse with `new URL(url.trim())`, allow strictly `http:` or `https:`, and call `child_process.execFileSync("curl", ["-sSL", "-m", "5", parsed.href], ...)` without spawning a shell.
- **`loadMermaidFileContent(...)`**: Enforce both lexical `isPathContained(baseDir|workspaceRoot, candidate)` before disk probing and canonical `fs.realpathSync` containment after file discovery to reject directory traversal and out-of-workspace symlinks.
- **Deterministic Escaping & Sanitization**: Escape `</` inside `#feed-registry` JSON script tags; escape `title`, `theme`, and `data-feed-fallback` via `escapeAttr()`; replace `.innerHTML` writes in `autoLinkMarkdownFiles()`, `createThemeSwatchButton()`, `05-projects-directory.js`, and `02-agent-dock-chat.js` with text nodes / `escapeHtml` / `sanitizeRenderedHtml` (`<template>` DOM strip of active tags, `on*` handlers, and `javascript:`/`vbscript:`/`data:text/html` URIs); validate custom theme identifiers (`/^[a-zA-Z0-9_-]{1,64}$/`).

### 2. Studio Server & Route Boundaries (`@html-report/studio`)
- **Shared Request Body Reader (`readRequestBody`)**: Added to [persona-and-session.mjs](file:///home/eta/projects/html-report/packages/studio/scripts/lib/server/persona-and-session.mjs) and re-exported via [server-utils.mjs](file:///home/eta/projects/html-report/packages/studio/scripts/server-utils.mjs) with a default `2 MB` (`2 * 1024 * 1024` bytes) cap returning HTTP `413` on overshoot.
- **Origin, CORS & Dotfile Defense**:
  - `server.mjs` wraps URL parsing and `decodeURIComponent` in `try/catch`, returning `400 Bad Request`.
  - `routes/static.mjs` rejects any dot-prefixed path segment with `404` prior to `rootDir` resolution and escapes `</` inside Markdown preview `<script>` blocks.
  - All mutating endpoints and `/api/mcp/csrf-token` enforce `enforceLocalBridgeSecurity` + `applyLocalCorsHeaders`, rejecting external origins and `Origin: null` cross-origin calls without wildcard CORS headers.
- **CLI & Flow Corrections**: Keep `args.mode` intact when `--pwa` is parsed in [harness/cli.mjs](file:///home/eta/projects/html-report/packages/core/scripts/lib/harness/cli.mjs); remove stray `return true;` blocking non-proxy requests when `--feed-proxy` is configured in [sse.mjs](file:///home/eta/projects/html-report/packages/studio/scripts/routes/sse.mjs); emit explicit `405 Method Not Allowed` responses on unsupported HTTP methods.
