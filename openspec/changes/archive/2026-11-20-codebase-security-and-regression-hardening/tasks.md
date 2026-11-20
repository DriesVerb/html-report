# Tasks: Codebase Security & Regression Hardening

> **Companion Dashboard:** [index.html](index.html) | **Proposal:** [proposal.md](proposal.md) | **Design:** [design.md](design.md) | **Delta Specs:** [specs/](specs/security-and-regression-hardening/spec.md)

## Phase 1: Core & Server Security Hardening

- [x] 1.1 Replace shell `execSync` in `fetchFeedSnapshotSync()` with `http:`/`https:` URL parsing + `execFileSync`, and enforce `isPathContained` + `realpathSync` containment in `loadMermaidFileContent()`.
- [x] 1.2 Enforce `enforceLocalBridgeSecurity`, `applyLocalCorsHeaders`, and bounded `readRequestBody` (`2 MB`) across mutating Studio routes, `/api/projects/delete`, and `/api/mcp/csrf-token`; add canonical `realpathSync` validation on project delete.
- [x] 1.3 Guard malformed URL decoding (`400`) in `server.mjs`, enforce pre-lookup dotfile blocking (`404`) and safe Markdown preview rendering in `routes/static.mjs`, and harden XSS sinks in assembly and client runtime/Studio UI.

## Phase 2: Functional Regressions, Documentation Sync & Verification

- [x] 2.1 Fix `harness.mjs --pwa` mode collision, `--feed-proxy` non-proxy request hang, `405` route fallthroughs, missing `node:crypto` import in `routes/mcp.mjs`, symlink `bin` CLI detection, `getAiConfig()` typo, `publishProject` `customTheme`/`pwa` forwarding, `edit-dock.html` `{ {` CSS syntax error, `report_build` enum, and port `3031` defaults.
- [x] 2.2 Synchronize [api-and-cli-reference.md](file:///home/eta/projects/html-report/docs/api-and-cli-reference.md), [cdn-stack.md](file:///home/eta/projects/html-report/docs/cdn-stack.md), [getting-started.md](file:///home/eta/projects/html-report/docs/getting-started.md), [testing-and-verification.md](file:///home/eta/projects/html-report/docs/testing-and-verification.md), and [html-pwa/SKILL.md](file:///home/eta/projects/html-report/skills/html-pwa/SKILL.md).
- [x] 2.3 Add [security-and-regressions.test.mjs](file:///home/eta/projects/html-report/packages/core/tests/security-and-regressions.test.mjs) and [server-security-regressions.test.mjs](file:///home/eta/projects/html-report/packages/studio/tests/server-security-regressions.test.mjs), verify full `npm run test:unit`, `npm run test:e2e`, `skill-router.mjs benchmark`, and archive cleanly on `main`.
