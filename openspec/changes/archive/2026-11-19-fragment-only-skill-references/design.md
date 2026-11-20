# Design: Fragment-Only Skill Reference Guides (70% Context Reduction)

> **Change:** `fragment-only-skill-references` | **Proposal:** [proposal.md](proposal.md) | **Tasks:** [tasks.md](tasks.md) | **Journey:** [index.html](index.html)

## Technical Decisions

### 1. Strict `<= 120`-Line Budget for `architecture-and-styling.md`
- Structure `skills/html-report/references/architecture-and-styling.md` into four high-signal sections:
  1. **Shell Invariants (Handled by `build-report.mjs` — Do Not Emit in `<main>`)**: Single bullet list noting that `<head>`, Core 4 + 15 on-demand CDNs, sticky `#navbar-report-title`, `#toc-dropdown`, `#settings-dropdown` (32 DaisyUI themes, PDF/HTML export, Edit Mode), `#print-cover-page`, and `<footer>` are injected automatically by `template-shell.html`.
  2. **15 On-Demand Addon Auto-Detection Table**: Maps each addon key to the exact HTML signature inside `<main>` that triggers automatic injection.
  3. **Canonical `<main id="report-main">` Layout & Component Recipes**: Copy-pasteable HTML blocks for:
     - Card header (`flex flex-wrap sm:flex-nowrap justify-between items-center gap-3 w-full`)
     - KPI Stats Grid (`grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4`)
     - Horizontal Stepper (`<div class="w-full overflow-x-auto"><ul class="steps steps-horizontal w-full min-w-[500px] text-xs font-semibold">...</ul></div>`)
     - Responsive Table (`<div class="overflow-x-auto w-full"><table class="table table-zebra table-sm w-full">...</table></div>`)
  4. **6 Canonical Rendering Modes & Server Policy**: Table of `report`, `print`, `presentation`, `dashboard`, `working-report`, `live-report`.

### 2. Automated Reference Digestibility Guard
- Add an assertion in `packages/core/tests/codebase-digestibility.test.mjs` (or a dedicated skill reference test) verifying that `skills/html-report/references/architecture-and-styling.md` stays `<= 150` lines and contains no raw `<header class="sticky` navbar dump.
