# Proposal: Evaluation Modes, Responsive UX & Security Hardening Improvements

> **Change:** `eval-modes-and-ux-improvements` | **Journey Companion:** [index.html](index.html) | **Design:** [design.md](design.md) | **Tasks:** [tasks.md](tasks.md) | **Delta Specs:** [reveal-presentation-fixes](specs/reveal-presentation-fixes/spec.md), [report-rendering-modes](specs/report-rendering-modes/spec.md), [declarative-widget-hydration](specs/declarative-widget-hydration/spec.md), [turnkey-agent-harness-cli](specs/turnkey-agent-harness-cli/spec.md), [reactive-data-copilot](specs/reactive-data-copilot/spec.md), [playwright-extensible-harness](specs/playwright-extensible-harness/spec.md), [skill-data-scaffolding-workflow](specs/skill-data-scaffolding-workflow/spec.md)

## Why

End-to-end evaluations across presentation, print, live-dashboard, and responsive Grid.js report workflows (`projects/eval-presentation-v1..v2`, `projects/eval-print-v1..v2`, `projects/eval-dashboard-v1..v2`) plus a security & static-analysis audit (Plans 1–5) identified five cross-cutting UX, runtime, CLI, and hardening gaps:

1. **Presentation Mode (Plan 1)**: Reveal.js `.reveal-viewport` painted opaque white over dark DaisyUI themes; `#presentation-notes-modal.hidden` had a dangling CSS selector comma; Mermaid diagrams on inactive slides collapsed to `16x16` due to `getBBox()` inside `display: none` slides; `#print-cover-page` headings leaked into TOC; and presentation docs recommended `--cdn-reveal` alone instead of `--mode presentation --quick`.
2. **Print Mode (Plan 2)**: Print builds lacked an `@page` A4 portrait margin contract, `thead`/`tfoot` pagination rules, Chart.js `resizeChartsForPrint()` hooks on `beforeprint`/`afterprint`/`exportReportPdf()`, full-width `.mermaid-wrapper` centering, and a dedicated `--mode print` scaffolding starter (`print-starter.mjs`).
3. **Live Dashboard & Local AI Bridge (Plan 3)**: `lintFragment()` and `stripOuterBoilerplate()` stripped reactive `<main data-signals>` roots; `harness.mjs`, `cli.mjs`, `server-policy.mjs`, and dashboard docs still referenced port `3000` instead of `3031`; `--ai-local` could be shadowed by an external CLI provider; `.mockup-code` terminal output overflowed cards and triggered false-positive `HighlightCheck` failures.
4. **Grid.js Mobile Responsiveness (Plan 4)**: Fixed table layout and wrapped headers broke mobile `640px` layouts on wide 10-column Grid.js tables while `checkInsufficientHorizontalSpace()` falsely flagged `.gridjs-wrapper`.
5. **Security & Scaffold Hardening (Plan 5)**: `stageReferenceFiles()` needed `realpathSync()` checks against symlink escapes outside `workspaceRoot`; `safeJsonEmbed()` needed `&`, `\u2028`, `\u2029` escaping; `isRateOrAvgColumn()` missed camelCase rate columns (`errorRate`); and `renderMermaidFlowWidget()` needed newline/special-character sanitization.

## What Changes

1. **Reveal.js Dark Theme, Hidden Mermaid & Notes Modal Fixes** (`template-shell.html`, `02-theme-switcher.js`, `03-shell-controls.js`, `reveal.mjs`, `structure.mjs`, presentation docs).
2. **Print A4 Pagination, Chart Resize, Mermaid Centering & `print-starter.mjs`** (`addon-registry.mjs`, `template-shell.html`, `03-shell-controls.js`, `07-settings-and-mermaid.js`, `08-publisher-and-board.js`, `report-runtime.js`, `print-starter.mjs`, `widget-templates.mjs`, `packages/studio/README.md`, `skills/html-print/SKILL.md`).
3. **Reactive `<main>` Preservation, Port `3031` Alignment, `--ai-local` Precedence & `.mockup-code` Isolation** (`fragment-linter.mjs`, `harness.mjs`, `cli.mjs`, `server-policy.mjs`, `file-watcher.mjs`, `server.mjs`, `agent-bridge.mjs`, `datastar-bridge.mjs`, `runner.mjs`, `highlight.mjs`, dashboard docs).
4. **Grid.js Mobile Scroll Containment & `checkInsufficientHorizontalSpace()` Exclusion** (`template-shell.html`, `03-shell-controls.js`, `gridjs.mjs`).
5. **Symlink Escape Rejection, JSON/Mermaid Sanitization & CamelCase Rate KPI Averaging** (`data-introspector.mjs`, `widget-templates.mjs`) plus comprehensive unit, integration, and Playwright E2E regression tests.
