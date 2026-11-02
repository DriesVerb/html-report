# Technical Design: Fast Deterministic Pipeline

## Context
See proposal.md - Why. The current workflow relies on LLMs writing hundreds of lines of identical JavaScript and HTML wrappers for every report. This design outlines how templates, CLI scripts, and Playwright verification interact to eliminate boilerplate and accelerate execution.

## Goals / Non-Goals

**Goals:**
- Provide a single static shell (`assets/template-shell.html`) and pre-bundled client script (`assets/report-runtime.js`).
- Implement `scripts/build-report.mjs` for sub-second assembly and feature auto-detection.
- Refactor `verify-report.mjs` to add `--quick` and dynamic feature checking.
- Fix DaisyUI v4 OKLCH color parsing via canvas 2D rendering and fix Mermaid 11 markdown list parsing.

**Non-Goals:**
- Replacing native Node.js ESM with a heavy build system (no Webpack, Vite, or TypeScript compilation step).
- Forcing external callers to adopt a new protocol; backward compatibility with full HTML generation is preserved.

## Decisions

### Decision 1: Canvas 2D Palette Resolver
- **Rationale**: DaisyUI v4 uses `oklch(...)` color definitions. Regex-based parsing (`rgba?\(...`) fails in modern Chromium and causes theme colors to fall back to a single flat color. A 1x1 `<canvas>` rendering context converts any CSS color space into exact 8-bit sRGB hex and rgba deterministically with zero dependencies.
- **Alternative considered**: Third-party color conversion libraries (`colord`, `culori`). Rejected because canvas 2D is native to all browsers.

### Decision 2: Hybrid CDN Selection (Auto-Detect + Flags)
- **Rationale**: Auto-detection (scanning content for `<canvas>`, `.mermaid`, `data-gridjs`, `katex`, `leaflet`, `hljs`) enables zero-configuration usage while CLI flags (`--charts`, `--mermaid`, etc.) allow explicit caller overrides.
- **Alternative considered**: Strict explicit flags only. Rejected because it increases friction for quick report generation.

### Decision 3: Template Shell with Clean Slots
- **Rationale**: `assets/template-shell.html` contains placeholders: `<!-- {{TITLE}} -->`, `<!-- {{FAVICON}} -->`, `<!-- {{HEAD_EXTRAS}} -->`, `<!-- {{CONTENT}} -->`, and `<!-- {{RUNTIME_SCRIPT}} -->`.
- **Alternative considered**: Complex AST HTML manipulation via Cheerio/JSDOM. Rejected because regex slot replacement is instantaneous (<5ms) and has zero runtime dependencies.

## Risks / Trade-offs

- **[Risk]** Dynamic CDN script tags loaded with `defer` might execute out of order if scripts depend on each other.
  - **Mitigation**: Core scripts load in order; runtime initialization uses DOMContentLoaded guards and optional feature checks (`window.Chart`, `window.mermaid`).
- **[Risk]** Mermaid markdown parser encountering ordered list tokens in subgraphs.
  - **Mitigation**: Disallow numbered list prefixes (`1. `, `2. `) in subgraph and node titles.
