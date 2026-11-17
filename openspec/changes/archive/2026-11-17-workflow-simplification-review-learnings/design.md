# Design: Post-Review Workflow Simplification & Reliability Improvements

> **Change:** `2026-11-17-workflow-simplification-review-learnings` | **Proposal:** [proposal.md](proposal.md) | **Tasks:** [tasks.md](tasks.md) | **Journey:** [index.html](index.html)

## Technical Decisions

### 1. Generic Workspace ESM Resolution & `process.execArgv` Preservation
- `.gitignore` uses `node_modules/*` with `!node_modules/@html-report/` and `!node_modules/@html-report/**` so `@html-report/core` and `@html-report/studio` symlinks are available immediately in fresh checkouts.
- `packages/core/scripts/workspace-loader.mjs` dynamically inspects `packages/*/package.json` (preserving the strict `@html-report/core` vs `@html-report/studio` zero-reference boundary) to resolve exact and wildcard subpath exports when `nextResolve` cannot find them.
- `packages/core/scripts/env.mjs` exports `ensureWorkspacePackageLinks()` and `getChildNodeExecArgs()`, which preserves `process.execArgv` across `skills/html-report/scripts/*.mjs`, `skills/html-report/playwright/verify-report.mjs`, `packages/studio/scripts/lib/server/supervisor.mjs`, and `packages/core/scripts/lib/harness/server-policy.mjs`.

### 2. Tightened Addon Detection & `--only-addons`
- `ADDON_REGISTRY` replaces bare word regexes (`\bmarked\b`, `\bshowdown\b`, `\bleaflet\b`, `\bkatex\b`, `chart\.js`, `\bhljs\b`, `\bdayjs\b`, `\bdatastar\b`) with DOM/JS signatures so prose reports load only the Core 4 shell.
- `detectAddons(content, explicitAddons, { autoDetect })` supports disabling auto-detection via `--no-auto-addons` or pinning an exact list via `--only-addons <list|none>`.

### 3. Direct Mermaid File Inclusion (`.mmd` / `.mermaid`)
- `resolveMermaidIncludes()` in `packages/core/scripts/lib/build/fragment-sanitizer.mjs` resolves both `<div|pre class="mermaid" data-mermaid-src="./file.mmd">` (and `data-src`) and `<!-- {{MERMAID:./file.mmd}} -->` / `<!-- @mermaid ./file.mmd -->` relative to `contentPath` or `workspaceRoot`, strips optional fenced blocks, escapes tag-opening `<`, and fails loudly with searched paths if missing.
- `packages/studio/scripts/lib/server/file-watcher.mjs` triggers forced fragment rebuilds when `.mmd` / `.mermaid` files change.

### 4. Screen-Hidden Print Cover & Verification Selection Clarity
- `packages/core/assets/template-shell.html` and `PRINT_MEDIA_CSS` declare `#print-cover-page, .print-only-summary { display: none; }` on screen; `skills/html-report/examples/example.html` uses `class="hidden print:flex ..."`.
- `core:structure` and `core:print-pdf` assert `#print-cover-page` is hidden (`display: none` or `visibility: hidden`) in `@media screen`, while `core:print-pdf` asserts `display: flex` in `@media print`.
- `PrintPdfCheck.cliFlags` moves from `--pdf` to `["--check-print", "--check-pdf"]`, and `--with-core` lets users combine targeted `--check-*` / `--cdns` flags with core baseline checks.
