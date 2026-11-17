# Tasks: Post-Review Workflow Simplification & Reliability Improvements

> **Companion Dashboard:** [index.html](index.html) | **Proposal:** [proposal.md](proposal.md) | **Design:** [design.md](design.md) | **Delta Specs:** [deterministic-assembly](specs/deterministic-assembly/spec.md) · [skill-packaging](specs/skill-packaging/spec.md)

## Phase 1: Packaging, Preview Startup & Module Resolution

- [x] 1.1 Un-ignore `node_modules/@html-report/` symlinks in `.gitignore`.
- [x] 1.2 Add generic ESM `packages/core/scripts/workspace-loader.mjs` + `ensureWorkspacePackageLinks()` / `getChildNodeExecArgs()` in `packages/core/scripts/env.mjs`.
- [x] 1.3 Forward `process.execArgv` across `supervisor.mjs`, `server-policy.mjs`, and all `skills/html-report/` CLI shims.

## Phase 2: Minimal Addons & Direct Mermaid Inclusion

- [x] 2.1 Tighten `ADDON_REGISTRY` signatures to eliminate English prose false-positives and add `--only-addons` / `--no-auto-addons`.
- [x] 2.2 Add `resolveMermaidIncludes()` (`data-mermaid-src`, `data-src`, `<!-- {{MERMAID:...}} -->`) to `build-report.mjs` and `harness.mjs`.
- [x] 2.3 Watch `.mmd` / `.mermaid` files in `packages/studio/scripts/lib/server/file-watcher.mjs`.

## Phase 3: Print Cover Concealment & Verification Selection

- [x] 3.1 Hide `#print-cover-page` / `.print-only-summary` on screen in `template-shell.html`, `PRINT_MEDIA_CSS`, and `example.html`.
- [x] 3.2 Add `@media screen` concealment assertions in `core:structure` and `core:print-pdf`.
- [x] 3.3 Move `PrintPdfCheck.cliFlags` off `--pdf`, add `--with-core`, clarify `Reporter.onRunStart()`, and reconcile `SKILL.md` & `architecture-and-styling.md`.

## Phase 4: Verification & Live Journey Sync

- [x] 4.1 Add unit, Playwright harness, and integration tests covering all 5 priorities.
- [x] 4.2 Build companion [index.html](index.html), sync `implementation-progress.html` on `localhost:3031`, and run full test + verify suites.
