# Proposal: Fragment-Only Skill Reference Guides (70% Context Reduction)

> **Change:** `fragment-only-skill-references` | **Journey Companion:** [index.html](index.html) | **Design:** [design.md](design.md) | **Tasks:** [tasks.md](tasks.md) | **Delta Spec:** [fragment-only-skill-references](specs/fragment-only-skill-references/spec.md)

## Why

`skills/html-report/references/architecture-and-styling.md` is currently **459 lines long** and embeds full HTML implementation blueprints for the `<head>` CDN script tags, the entire sticky `<header class="navbar">` DOM hierarchy, the 32-theme dropdown list markup, and the `<footer>` tag.

Because agents **only emit `<main id="report-main">`** (while `build-report.mjs` deterministically injects `template-shell.html`), feeding agents 300+ lines of shell HTML wastes context window tokens, slows down reference reading, and actively confuses LLMs into emitting duplicate `<header>` navbars or `<head>` tags inside their fragment.

## What Changes

1. **Condense `architecture-and-styling.md` to `<= 120` Lines (Fragment-Only Cheat Sheet)**:
   - Remove raw `<head>`, `<header class="navbar">`, and `<footer>` HTML source dumps (moving any deep shell contributor notes to `packages/core/README.md`).
   - Replace with a concise **"What `template-shell.html` Provides Automatically (Never Emit in `<main>`)"** summary.
2. **Copy-Pasteable `<main>` Component Recipes**:
   - Provide compact, canonical `<main>` recipes for responsive card headers, KPI `stat` grids, horizontal steppers (`steps-horizontal`), responsive tables (`overflow-x-auto`), and Showdown markdown triggers (`openMarkdownViewer('file.md')`).
3. **Compact Addon Auto-Detection & Mode Reference Tables**:
   - Keep the 15 on-demand addon trigger table and the 6 canonical rendering modes (`report`, `print`, `presentation`, `dashboard`, `working-report`, `live-report`) in scannable markdown tables.
