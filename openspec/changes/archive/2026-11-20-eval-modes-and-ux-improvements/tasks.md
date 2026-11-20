# Tasks: Evaluation Modes, Responsive UX & Security Hardening Improvements

> **Companion Dashboard:** [index.html](index.html) | **Proposal:** [proposal.md](proposal.md) | **Design:** [design.md](design.md) | **Delta Specs:** [specs/](specs/reveal-presentation-fixes/spec.md)

## Phase 1: Presentation & Print Mode Fixes (Plans 1 & 2)

- [x] 1.1 Fix `.reveal-viewport` dark-theme transparency, `#presentation-notes-modal.hidden`, hidden-slide `mermaid.render()` fallback, `#print-cover-page` TOC exclusion, `RevealCheck` assertions, and presentation docs (`--mode presentation --quick`).
- [x] 1.2 Add `@page` A4 portrait rules and print pagination CSS (`addon-registry.mjs`, `template-shell.html`), `resizeChartsForPrint()`, full-width `.mermaid-wrapper` centering, `print-starter.mjs`, and `skills/html-print/SKILL.md` updates.

## Phase 2: Live Dashboard, Local Bridge & Grid.js Mobile Fixes (Plans 3 & 4)

- [x] 2.1 Preserve reactive `<main>` attributes in `fragment-linter.mjs`, align `harness.mjs` / `cli.mjs` / `server-policy.mjs` & dashboard docs to port `3031` with `--ai-local` forwarding, and enforce `--ai-local` precedence + `.mockup-code` wrapping/highlight exclusion.
- [x] 2.2 Make Grid.js tables responsive on `640px` viewports (`.gridjs-wrapper` `overflow-x: auto`, `table-layout: auto`, `white-space: nowrap` headers), skip Grid.js wrappers in `checkInsufficientHorizontalSpace()`, and assert `overflowPx <= 2` in `GridJsCheck`.

## Phase 3: Security Hardening, Tests, Spec Sync & Archive (Plan 5 & Plan 6)

- [x] 3.1 Reject symlink escapes in `stageReferenceFiles()`, harden `safeJsonEmbed()` / `renderMermaidFlowWidget()`, and support camelCase rate columns in `isRateOrAvgColumn()`.
- [x] 3.2 Run `npm run test:unit` and `npm run test:e2e`, sync delta specs to `openspec/specs/`, validate with `openspec validate`, update [index.html](index.html) + `implementation-progress.html`, archive, and commit cleanly on `main`.
