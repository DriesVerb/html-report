# Design: Evaluation Modes, Responsive UX & Security Hardening Improvements

> **Change:** `eval-modes-and-ux-improvements` | **Proposal:** [proposal.md](proposal.md) | **Tasks:** [tasks.md](tasks.md) | **Journey:** [index.html](index.html)

## Technical Decisions

### 1. Reveal.js Presentation Fixes (Plan 1)
- **Files**: `packages/core/assets/template-shell.html`, `packages/core/assets/runtime/02-theme-switcher.js`, `packages/core/assets/runtime/03-shell-controls.js`, `packages/core/playwright/harness/checks/cdns/reveal.mjs`, `packages/core/playwright/harness/checks/core/structure.mjs`, `skills/html-presentation/SKILL.md`, `skills/html-report/references/reveal-presentation-style-guide.md`.
- Force `.reveal-stage .reveal` and `.reveal-stage .reveal.reveal-viewport` to `background: transparent !important` so dark DaisyUI `.reveal-stage` themes show through without opaque white paint.
- Fix the dangling comma on `#presentation-notes-modal.hidden { display: none !important; }`.
- Add `isMermaidContainerHidden(node)` in `02-theme-switcher.js`; when inactive Reveal.js slides or `[hidden]` ancestors hide a `.mermaid` container, render visible diagrams with `mermaid.run({ nodes: visibleNodes })` and render hidden diagrams offscreen via `mermaid.render(id, src)` so SVG `viewBox` dimensions never collapse.
- Exclude `#print-cover-page`, `.notes`, and `#presentation-notes-modal` headings from `initTOC()` and `StructureCheck`.
- Assert transparent `.reveal` stage background and initially hidden `#presentation-notes-modal` in `RevealCheck`.

### 2. Print A4 Pagination, Chart Resize & Print Starter (Plan 2)
- **Files**: `packages/core/scripts/lib/build/addon-registry.mjs`, `packages/core/assets/template-shell.html`, `packages/core/assets/runtime/03-shell-controls.js`, `packages/core/assets/runtime/07-settings-and-mermaid.js`, `packages/core/assets/runtime/08-publisher-and-board.js`, `packages/core/assets/report-runtime.js`, `packages/studio/scripts/lib/scaffold/print-starter.mjs`, `packages/studio/scripts/lib/scaffold/widget-templates.mjs`, `packages/studio/README.md`, `skills/html-print/SKILL.md`.
- Add `@page { size: A4 portrait; margin: 12mm 14mm 16mm 14mm; }`, full-width `#report-main`, `thead { display: table-header-group !important; }`, `tfoot { display: table-row-group !important; }`, `tr/td/th { break-inside: avoid !important; }`, `.overflow-x-auto { overflow: visible !important; }`, and `canvas { max-width: 100% !important; height: auto !important; }` to `PRINT_MEDIA_CSS` and base `@media print`.
- Export `resizeChartsForPrint()` and invoke it inside `exportReportPdf()` and `beforeprint` / `afterprint` / `matchMedia("print")` listeners.
- Center `.mermaid` and `.mermaid-wrapper` across full container width (`w-full flex justify-center`).
- Add `renderPrintStarterFragment()` in `print-starter.mjs` for `--mode print` scaffolding with `#print-cover-page`, KPI summary, `table-xs` itemized ledger, and sign-off attestation.

### 3. Live Dashboard Reactive `<main>`, Port `3031` & `--ai-local` Precedence (Plan 3)
- **Files**: `packages/core/scripts/lib/harness/fragment-linter.mjs`, `packages/core/scripts/harness.mjs`, `packages/core/scripts/lib/harness/cli.mjs`, `packages/core/scripts/lib/harness/server-policy.mjs`, `packages/studio/scripts/lib/server/file-watcher.mjs`, `packages/studio/scripts/server.mjs`, `packages/studio/scripts/routes/agent-bridge.mjs`, `packages/studio/scripts/lib/datastar/datastar-bridge.mjs`, `packages/core/playwright/harness/runner.mjs`, `packages/core/playwright/harness/checks/cdns/highlight.mjs`, `skills/html-dashboard/SKILL.md`, `skills/html-report/references/datastar-live-dashboards.md`.
- Preserve reactive `<main>` attributes (`data-signals`, `x-data`, `x-init`, `data-store`, `data-on-`) in `lintFragment()` and convert outer `<main ...>` to `<div ...>` with attributes intact inside `stripOuterBoilerplate()`.
- Align default ports in `harness.mjs`, `cli.mjs`, `server-policy.mjs`, and dashboard docs from `3000` to `3031`, add `--ai` / `--ai-local` / `--ai-port` flags to `harness.mjs`, and preserve manifest fields (`servingMode`, `behavioralMode`, `starterFragmentHash`, `presetWidgets`, `referenceFiles`, `customTheme`, `audience`, `goals`) across rebuilds.
- Give `local-bridge` (`--ai-local`) precedence in `server.mjs` when no explicit `provider` or custom `HTML_REPORT_AI_CMD` / `siblingCmd` is set, forward `aiLocal` from `file-watcher.mjs`, and fall back to `sendLocalBridgeReply()` on provider failure in `agent-bridge.mjs` when `localMode` is true.
- Wrap `.mockup-code` lines (`w-full max-w-full`, `whitespace-pre-wrap break-words`) in `datastar-bridge.mjs`, and exclude `.mockup-code` elements without `.hljs` / `language-*` from `runner.mjs` `hasCode` and `HighlightCheck`.

### 4. Grid.js Mobile Responsive Tables (Plan 4)
- **Files**: `packages/core/assets/template-shell.html`, `packages/core/assets/runtime/03-shell-controls.js`, `packages/core/playwright/harness/checks/cdns/gridjs.mjs`.
- Constrain `.gridjs-container` and `.gridjs-wrapper` to `width: 100% !important; max-width: 100% !important; overflow-x: auto !important;`, switch `.gridjs-table` to `table-layout: auto !important; min-width: 100% !important;`, keep `th.gridjs-th` single-line (`white-space: nowrap !important`) with absolute sort icon positioning, and constrain `input.gridjs-input.gridjs-search-input` to `max-width: 100%`.
- Skip `.gridjs-wrapper` and `.gridjs-table` in `checkInsufficientHorizontalSpace()` and assert `overflowPx <= 2` in `GridJsCheck`.

### 5. Security & Scaffold Hardening (Plan 5)
- **Files**: `packages/studio/scripts/lib/scaffold/data-introspector.mjs`, `packages/studio/scripts/lib/scaffold/widget-templates.mjs`.
- Resolve `fs.realpathSync()` for `workspaceRoot` and candidate files inside `stageReferenceFiles()` to reject symlink escapes outside `workspaceRoot`.
- Harden `safeJsonEmbed()` (`&`, `\u2028`, `\u2029`), `isRateOrAvgColumn()` (camelCase suffixes such as `errorRate`, `latencyMs`), and `renderMermaidFlowWidget()` (strip `\r\n` and `` `{}() `` from labels).
