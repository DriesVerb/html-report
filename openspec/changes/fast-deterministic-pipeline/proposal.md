# Proposal: Fast Deterministic Pipeline & Token-Elimination Architecture

## Why
Generating an HTML report currently consumes ~2,800 LLM output tokens and takes 45–90 seconds because the agent manually synthesizes ~450 lines of static boilerplate (head tags, 11 CDNs, DaisyUI 32-theme switcher, TOC generator, horizontal space detector, snapshot inliner). Furthermore, every report needlessly runs a heavyweight Playwright test that exports 5 mock PDFs across 5 themes even when only an interactive browser report is needed.

This change introduces a deterministic assembly engine and reusable asset shell, shifting boilerplate generation from expensive LLM tokens to sub-second local CLI scripts, reducing token usage by ~70% and accelerating turnaround by 3.5x.

## What Changes
- **HTML Fragment Input Format**: LLMs and calling skills generate *only* the semantic `<main>` content fragment instead of complete standalone HTML documents.
- **Pre-Generated Asset Shell & Runtime**: Move the standard HTML head, sticky DaisyUI navbar, 32-theme swatch switcher, TOC builder, and space detector into static files (`assets/template-shell.html` and `assets/report-runtime.js`).
- **Deterministic Build CLI (`scripts/build-report.mjs`)**: Node.js script that stitches the shell, runtime, and content fragment in <100ms.
- **Dynamic Modular CDN Loading**: Baseline loads only Core 4 libraries (Tailwind, DaisyUI v4, Lucide Icons, Alpine.js). Optional libraries (Chart.js, Mermaid, Grid.js, KaTeX, Leaflet, Highlight.js) are auto-detected from content signatures and supported via explicit CLI flags.
- **On-Demand Single PDF Export**: Default to Web-First reports (zero `@media print` rules, zero cover page overhead, zero PDF exports). When `--printable` or `--pdf <file>` is explicitly passed, Playwright exports exactly 1 target PDF in the active theme.
- **Lean Playwright Verifier (`--quick`)**: Fast 2-breakpoint verification (`sm` and `lg`) and health check completed in <4 seconds.
- **Canvas-Based Color Resolver & Mermaid List Bug Defense**: Upgrades palette resolution to use an offscreen 2D canvas (supporting modern `oklch` CSS colors) and avoids numbered list tokens in Mermaid subgraphs.

## Capabilities

### New Capabilities
- `deterministic-assembly`: Deterministic templating, content fragment injection, auto-detected and flag-controlled CDN loading, and sub-second HTML report emission.
- `lean-verification`: Fast Playwright verification testing active features, responsive breakpoints, and single target PDF export on demand.

### Modified Capabilities
None.

## Impact
- **Affected Files**: `skills/html-report/SKILL.md`, `skills/html-report/assets/*`, `skills/html-report/scripts/build-report.mjs`, `skills/html-report/playwright/verify-report.mjs`.
- **Backward Compatibility**: Fully backward compatible. Existing callers can continue using `build-report.mjs` or passing raw fragments. Zero breaking changes to output format.
