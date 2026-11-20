# security-and-regression-hardening Specification

## Purpose
Defines security controls, containment checks, origin/CORS restrictions, input bounds, and CLI/server regression invariants across `@html-report/core` and `@html-report/studio`.

## Requirements

### Requirement: Build-Time Fetch, Include Containment & Script Escaping
`fetchFeedSnapshotSync()` SHALL validate an `http:` or `https:` URL and invoke `curl` without a shell via `execFileSync`. `loadMermaidFileContent()` SHALL enforce lexical and canonical (`realpathSync`) workspace/content-dir containment. `buildReport()` and `routes/static.mjs` SHALL escape `</` inside inline JSON/script payloads and HTML-escape untrusted attribute/title values.

#### Scenario: Untrusted feed URL or Mermaid traversal is blocked
- **WHEN** `fetchFeedSnapshotSync()` receives `file:///...` or shell metacharacters, or `resolveMermaidIncludes()` receives a traversal path or external symlink
- **THEN** no shell command executes and external file reads fail with an access-denied error.

#### Scenario: Malicious title or Markdown script breakout is neutralized
- **WHEN** `buildReport()` receives `</title><script>` or `</script>` inside feeds, or `routes/static.mjs` previews a `.md` file containing `</script><script>`
- **THEN** closing script tags and raw HTML tags are escaped and rendered HTML is DOM-sanitized.

### Requirement: Local Dev Server Route Security & Dotfile Guard
Mutating Studio API routes and `/api/mcp/csrf-token` SHALL enforce loopback host and local `Origin` checks without emitting wildcard CORS (`*`) and SHALL bound request bodies (`413`). `server.mjs` SHALL return `400` on malformed percent-encoded paths and `routes/static.mjs` SHALL return `404` for dot-prefixed segments.

#### Scenario: Cross-origin delete, dotfile probe, or malformed URL is rejected cleanly
- **WHEN** an external origin or `Origin: null` POSTs to `/api/projects/delete` or `/api/mcp/csrf-token`, a client GETs `/.env` or `/.git/HEAD`, or a client sends `/%E0%A4%A`
- **THEN** the server rejects the cross-origin mutation (`403`), denies dotfile access (`404`), and responds `400` without crashing.

### Requirement: Proxy Fallthrough & `--pwa` Harness Mode Preservation
`routes/sse.mjs` SHALL allow non-proxy requests to fall through when `--feed-proxy` is configured, and `harness.mjs --pwa` SHALL enable PWA output without altering canonical report mode.

#### Scenario: `harness.mjs --pwa` and `--feed-proxy` complete normally
- **WHEN** `harness.mjs` runs with `--pwa` or `serve-report.mjs` serves `/` alongside `--feed-proxy`
- **THEN** `harness.mjs` compiles the deliverable with `manifest.webmanifest`/`sw.js`/`icon.svg` without `INVALID_MODE` and `serve-report.mjs` serves non-proxy HTML normally.
