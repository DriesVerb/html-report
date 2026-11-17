# Proposal: Post-Review Workflow Simplification & Reliability Improvements

> **Change:** `2026-11-17-workflow-simplification-review-learnings` | **Journey Companion:** [index.html](index.html) | **Design:** [design.md](design.md) | **Tasks:** [tasks.md](tasks.md) | **Delta Specs:** [deterministic-assembly](specs/deterministic-assembly/spec.md) · [skill-packaging](specs/skill-packaging/spec.md)

## Why

A pre-refactoring field review of the `html-report` workflow surfaced five high-priority friction points between `"build succeeded"` and a dependable preview/verification pass:

1. **Preview Server Module Resolution & Supervisor `execArgv` Drop**: `node_modules/` was fully gitignored (omitting workspace symlinks `node_modules/@html-report/{core,studio}` in clean checkouts), and `supervisor.mjs` + CLI shims dropped `process.execArgv` flags (`--import`, `--loader`) when spawning workers.
2. **Over-Eager Addon Detection & Drifted Stack Docs**: `detectAddons()` matched bare English prose words (`marked`, `showdown`, `Leaflet`, `KaTeX`, `Chart.js`, `hljs`, `dayjs`, `datastar`), injecting unnecessary CDNs, while `architecture-and-styling.md` still described an unconditional 11-library stack.
3. **Duplicated Mermaid Diagram Sources**: Authors maintaining standalone `.mmd` files had to copy-paste diagram text into `fragment.html` manually.
4. **Screen-Visible Print Cover Gap**: `#print-cover-page` lacked a default screen-hidden CSS rule and `verify-report.mjs` checked `@media print` visibility without asserting `@media screen` concealment.
5. **Ambiguous Verification Flag Filtering**: `--pdf` was listed in `PrintPdfCheck.cliFlags` (silently skipping all other checks when exporting a PDF), and targeted `--check-*` flags needed clearer documentation and a `--with-core` combination flag.

## What Changes

1. **Zero-Install Preview & Loader Forwarding**: Un-ignore `node_modules/@html-report/`, add generic ESM `packages/core/scripts/workspace-loader.mjs` + `env.mjs` (`ensureWorkspacePackageLinks`, `getChildNodeExecArgs`), and forward `process.execArgv` across `supervisor.mjs`, `server-policy.mjs`, and all `skills/html-report/` CLI shims.
2. **Precision Addon Detection & Explicit Controls**: Tighten `ADDON_REGISTRY` signatures to HTML/JS patterns and add `--only-addons <list>` and `--no-auto-addons` to `build-report.mjs`.
3. **Direct `.mmd` / `.mermaid` File Inclusion**: Add `resolveMermaidIncludes()` (`data-mermaid-src`, `data-src`, `<!-- {{MERMAID:...}} -->`) in `build-report.mjs` / `harness.mjs` and watch `.mmd`/`.mermaid` files in `file-watcher.mjs`.
4. **Screen-Hidden `#print-cover-page` Guard & Checks**: Hide `#print-cover-page` / `.print-only-summary` on screen in `template-shell.html`, `PRINT_MEDIA_CSS`, and `example.html`, and enforce screen concealment in `core:structure` and `core:print-pdf`.
5. **Clear Verification Selection & Reconciled Guidance**: Move `PrintPdfCheck.cliFlags` from `--pdf` to `--check-print`/`--check-pdf`, add `--with-core`, clarify `Reporter.onRunStart()` and `--help`, and align `SKILL.md` (`<= 5,120` bytes) and `architecture-and-styling.md`.
