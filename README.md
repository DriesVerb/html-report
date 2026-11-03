# ⚡ `html-report` — Publication-Grade HTML5 Reports for AI Coding Agents

[![Agent Skill](https://img.shields.io/badge/Agent%20Skill-LLM--Agnostic-blueviolet.svg)](https://agentskills.io)
[![OpenSpec](https://img.shields.io/badge/OpenSpec-Evolved-emerald.svg)](https://github.com/Fission-AI/OpenSpec)
[![Themes](https://img.shields.io/badge/DaisyUI%20v4-32%20Themes-ff5724.svg)](https://daisyui.com/docs/themes/)
[![CDNs](https://img.shields.io/badge/CDN%20Stack-16%20Libraries-3b82f6.svg)](#the-16-library-cdn-power-stack)
[![Assembly Speed](https://img.shields.io/badge/Assembly-%3C100ms-success.svg)](#blazing-speed--token-efficiency)
[![FSM Harness](https://img.shields.io/badge/FSM%20Harness-Deterministic-cyan.svg)](#the-superpower-of-states-deterministic-fsm-harness)
[![Playwright](https://img.shields.io/badge/Verified-Playwright%205--Breakpoints-2ea44f.svg)](#horizontal-scrollbar-detection--playwright-gate)

> **The fastest, most reliable way for AI coding agents to produce publication-grade, interactive, theme-adaptive, and print/PDF-ready HTML5 reports.**  
> Built for **Antigravity, Claude Code, Cursor, Codex, OpenCode, Gemini CLI**, and autonomous agent pipelines.

---

## 🚀 Super Easy Install

### Option A: Install as a Prompt (Copy & Paste into Your AI Agent)

Paste this single prompt directly into **Antigravity, Claude Code, Cursor, Codex, OpenCode, or Gemini CLI** and let your agent configure everything automatically:

```text
Install the html-report skill from https://github.com/DriesVerb/html-report.git by cloning it into ~/.agents/html-report, symlinking ~/.agents/html-report/skills/html-report into ~/.agents/skills/html-report (and ~/.gemini/config/skills/html-report if using Antigravity/Gemini), and installing Playwright in ~/.agents/html-report/skills/html-report/playwright. Then read skills/html-report/SKILL.md.
```

### Option B: 1-Line Terminal Command

```bash
# Via the universal Agent Skills CLI:
npx skills add DriesVerb/html-report

# Or via 1-line git clone + global symlinks:
git clone https://github.com/DriesVerb/html-report.git ~/.agents/html-report && \
  mkdir -p ~/.agents/skills ~/.gemini/config/skills && \
  ln -sfn ~/.agents/html-report/skills/html-report ~/.agents/skills/html-report && \
  ln -sfn ~/.agents/html-report/skills/html-report ~/.gemini/config/skills/html-report
```

---

## 💡 Why `html-report`?

When LLMs generate full HTML documents from scratch, they waste **70% to 80% of their output tokens** writing boilerplate: doctypes, CDN imports, CSS resets, repetitive navbar markup, theme switchers, and inline JavaScript glue. Worse, models frequently hallucinate broken CDN links, omit heading anchor IDs, miscalculate responsive widths causing mobile overflow, and enter infinite retry loops.

`html-report` solves this with a **deterministic state machine pipeline**:
- **Agents emit only the semantic content fragment** (headings, metric cards, charts, diagrams, tables).
- The **deterministic harness** validates, auto-fixes, stitches the fragment into a pre-bundled publication shell in **<100ms**, and verifies it across 5 viewport breakpoints.

```
                    TRADITIONAL LLM GENERATION
┌─────────────────────────────────────────────────────────────────┐
│ 1,500+ Tokens: Doctype + 11 CDNs + CSS + Sticky Nav + JS Glue   │ ❌ Slow & Fragile
│ 500 Tokens: Actual Report Insights & Visuals                    │ ❌ High Hallucination Risk
└─────────────────────────────────────────────────────────────────┘

                    THE html-report PIPELINE
┌──────────────────────────────────────────────┐
│ Agent Emits ONLY Semantic <main> (500 Tokens)│ ⚡ ~70% Token Savings
└──────────────────────┬───────────────────────┘
                       │ <2ms Cold Startup
                       ▼
┌──────────────────────────────────────────────┐
│ Deterministic State Machine Harness (FSM)    │ 🛡️ Auto-Fixes & Small-Model Remediation
└──────────────────────┬───────────────────────┘
                       │ <100ms Deterministic Assembly
                       ▼
┌──────────────────────────────────────────────┐
│ Publication-Grade HTML5 Report + PDF         │ 🎨 32 Themes, Offline Inlining, Zero Overflows
└──────────────────────────────────────────────┘
```

---

## ⚡ Blazing Speed & Token Efficiency

| Benchmark Metric | Traditional Agent Generation | With `html-report` | Advantage |
| :--- | :--- | :--- | :--- |
| **Agent Output Tokens** | ~2,500+ tokens | **~500–800 tokens** | **~70% token savings** |
| **Compilation Latency** | Full LLM generation (~10–25s) | **<100ms** deterministic assembly | **100x faster execution** |
| **CLI Cold Startup** | 300–800ms (Heavy CLI frameworks) | **<2ms** (Zero-dependency Node engine) | **Near-instant runtime** |
| **Pre-Flight Repairs** | 1+ LLM turn (~5–10s) | **<1ms** mechanical auto-fix | **Zero token burn for trivial fixes** |
| **Viewport Verification** | Manual browser inspection | **<4s** lean Playwright check | **Instant responsive confidence** |
| **Dev Server Reload** | Manual refresh / duplicate tabs | **Instant single-tab live sync** | **Seamless developer experience** |

---

## 🛡️ The Superpower of States: Deterministic FSM Harness

At the core of `html-report` is an explicit, zero-dependency Node.js **Finite State Machine (FSM)** (`skills/html-report/scripts/harness.mjs`). By modeling the compilation lifecycle as mathematically defined states, the system achieves bulletproof reliability:

```mermaid
flowchart TD
    IDLE["1. IDLE (Zero-Dep Node Engine <2ms)"] --> CHECK_CALLER{"Has --caller?"}
    
    CHECK_CALLER -- Yes --> RESOLVING_CALLER["2. RESOLVING_CALLER\n(Load Profile & 3-Tier Config)"]
    CHECK_CALLER -- No --> VALIDATING
    
    RESOLVING_CALLER --> VALIDATING["3. VALIDATING\n(Semantic Checks & Linting)"]
    VALIDATING --> AUTO_FIXING["4. AUTO_FIXING\n(Mechanical Repairs in <1ms)"]
    AUTO_FIXING --> ASSEMBLING["5. ASSEMBLING\n(Deterministic Build in <100ms)"]
    ASSEMBLING --> VERIFYING["6. VERIFYING\n(Playwright Multi-Breakpoint Check)"]
    
    VERIFYING -- Success --> RECORDING_RUN{"Has --caller?"}
    RECORDING_RUN -- Yes --> WRITE_VAULT["7. RECORDING_RUN\n(Persist Trace & 10-Run Prune)"]
    RECORDING_RUN -- No --> COMPLETED
    WRITE_VAULT --> COMPLETED["8. COMPLETED\n(./report.html or ./report-caller.html)"]
    
    VERIFYING -- Issues & Retries Left --> REMEDIATING["9. REMEDIATING\n(Spoon-Fed Prescriptive JSON Directive)"]
    REMEDIATING -. Attempt 2 or 3 .-> VALIDATING
    
    VERIFYING -- Exceeded 3 Retries --> FAILED["10. FAILED\n(Terminal Bounded Safety Ceiling)"]

    classDef state fill:#2563eb,stroke:#1d4ed8,stroke-width:2px,color:#fff;
    classDef success fill:#16a34a,stroke:#15803d,stroke-width:2px,color:#fff;
    classDef remediation fill:#f59e0b,stroke:#d97706,stroke-width:2px,color:#000;
    classDef failure fill:#dc2626,stroke:#b91c1c,stroke-width:2px,color:#fff;
    
    class IDLE,RESOLVING_CALLER,VALIDATING,AUTO_FIXING,ASSEMBLING,VERIFYING,WRITE_VAULT state;
    class COMPLETED success;
    class REMEDIATING remediation;
    class FAILED failure;
```

### 1. Mechanical Pre-Flight Auto-Fix State (`AUTO_FIXING`)
Smaller models frequently include accidental `<html>` or `<body>` wrappers, forget `id` attributes on headings, or omit table wrapper divs. The `AUTO_FIXING` state automatically fixes these in **<1ms with zero LLM round-trips**:
- Strips accidental outer document tags and YAML frontmatter.
- Automatically generates kebab-case slugified `id` attributes for all `h1`, `h2`, and `h3` tags (guaranteeing the navbar Table of Contents works out-of-the-box).
- Wraps unadorned tables with responsive `overflow-x-auto` wrappers.

### 2. "Small-Model-First" Spoon-Fed Remediation State (`REMEDIATING`)
When Playwright catches CSS overflow or responsive regressions, smaller models (e.g. Flash-Lite, Haiku, or local models) get overwhelmed by raw stack traces. The harness intercepts errors and outputs an **actionable, spoon-fed JSON directive**:

```json
{
  "status": "REMEDIATING",
  "attempt": 1,
  "max_attempts": 3,
  "instruction_for_agent": "CRITICAL: Fix horizontal scrollbar on element #workload-table. Replace container with <div class='overflow-x-auto w-full max-w-full'> to resolve overflow at mobile breakpoint (375px)."
}
```

### 3. Bounded Retry Supervisor
Enforces a strict **3-attempt ceiling**. If an agent cannot resolve issues within 3 attempts, the harness enters `FAILED` and stops, protecting tokens and preventing hallucination loops.

### 4. Progressive Complexity: Standalone vs. Caller-Aware Mode
The state machine operates with strict progressive disclosure:
- **Standalone Mode (`node harness.mjs run fragment.html`)**: **Zero footprint**. Does not touch or create `.caller-requests/`, performs zero profile queries, and outputs directly to `./report.html`.
- **Caller-Aware Mode (`--caller <id>`)**: Functions as a **shared visual rendering bus** for other agent skills (`memory-leak-debugging`, `debug-optimize-lcp`, etc.). Loads caller profiles, enforces 3-tier config precedence (`Runtime Overrides` > `Caller Profile` > `Core Baseline`), auto-routes to `./report-<caller>.html`, and logs ephemeral traces with a strict 10-run pruning policy.

---

## 🎨 The 16-Library CDN Power Stack

All reports utilize a carefully curated, non-blocking CDN stack pre-wired for instant interactivity and responsive elegance:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          CORE FOUNDATION (Loaded Always)                    │
│  Tailwind CSS (CDN)  │  DaisyUI v4 (All 32 Themes)  │  Lucide  │  Alpine.js │
└─────────────────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────────────────┐
│                   ON-DEMAND ADDONS (Auto-Detected by Harness)               │
│  Chart.js 4.4    — Animated Canvas Charts (2D OKLCH Palette Theme Synced)   │
│  Mermaid 11.4    — Architecture & Sequence Diagrams (DaisyUI Theme Synced)  │
│  Leaflet 1.9     — Interactive Maps (Esri Street Tiles, 0 API Keys, 0 403s) │
│  Grid.js 6.0     — Searchable, Sortable, Paginated Tables (Dark-Mode Synced)│
│  KaTeX 0.16      — Scientific & LaTeX Equation Math Rendering               │
│  Marked 14.1     — Client-Side Markdown Prose Rendering                     │
│  Highlight.js 11 — Syntax Highlighting (TypeScript, Kotlin, Python, Bash)   │
│  Day.js 1.11     — Lightweight Date Formatting & Relative Timestamps        │
│  Impress.js 2.0  — 3D Presentations (Presentation-Guarded, Print Fallback)  │
│  Mock.js 1.1     — Client-Side Synthetic Data & Schema Simulation           │
│  Showdown 2.1    — Two-Way Markdown Converter (Zero Marked Collision)       │
│  FullCalendar 6  — Interactive Scheduling Grids & Theme Palette Sync        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🌟 Publication-Grade Features

### 1. Sticky DaisyUI Navbar with 32 Theme Swatches
- **Left (`navbar-start`)**: Prominent Report Title.
- **Right (`navbar-end`)**:
  - **Contents Dropdown (`#toc-dropdown`)**: Dynamically maps and anchors all `h1`, `h2`, and `h3` headers.
  - **32-Theme DaisyUI Selector (`#theme-dropdown`)**: Interactive color-swatch previews for every official theme (`light`, `dark`, `cupcake`, `synthwave`, `cyberpunk`, `nord`, etc.). Switching themes instantly re-themes **Chart.js**, **Mermaid**, **Grid.js**, and text colors via offscreen 2D canvas OKLCH resolution.
  - **Icon-Only Download Dropdown (`#download-dropdown`)**: Clean icon button opening two download paths:
    - **Download as HTML**: Downloads a 100% standalone offline `.html` file with all external CDN CSS and JS assets inlined into `<style>` and `<script>` tags.
    - **Download as PDF**: Direct browser print/PDF generation with print media rules.

### 2. CSV-Backed Interactive Dashboards
Easily pair data files (e.g. `example.csv`) with interactive metric summaries, live search inputs, client-side filters, and reactive Grid.js tables with instant chart synchronization.

### 3. Horizontal Scrollbar ("Insufficient Space") Detection & Playwright Gate
The runtime and Playwright verifier automatically check every element across all 5 Tailwind breakpoints (`sm`: 640px, `md`: 768px, `lg`: 1024px, `xl`: 1280px, `2xl`: 1536px). If any element has a horizontal scrollbar (`scrollWidth > clientWidth`), it is visually flagged and reported so reports are guaranteed 100% responsive.

### 4. User-Defined Custom DaisyUI Themes & Top Collapsible Studio
- **Zero-Dependency Pure JS OKLCH Engine**: Converts any hex, RGB, or HSL color into DaisyUI 4 OKLCH channels (`L% C H`) using standard Ottosson matrix math without external CDN color libraries.
- **Theme Inheritance (`extends`)**: Support for `"extends": "<baseTheme>"` allows extending any of the 32 native DaisyUI themes (`dark`, `light`, `emerald`, `synthwave`, etc.) while overriding chosen semantic colors.
- **Auto-Contrast Content Generator**: Computes optimal high-contrast values for `-content` variables (`--pc`, `--sc`, `--ac`, `--bc`, etc.) automatically.
- **Build-Time CLI Integration**: Pass `--custom-theme <path>` (supporting `.json` and raw `.css` blocks) to inject custom themes into `<style id="daisyui-custom-themes">`.
- **In-Browser Top Collapsible Studio**: Interactive accordion banner beneath the document title with real-time color pickers, OKLCH monitors, live Chart.js/Mermaid reactivity, `localStorage` persistence, and one-click CSS & Tailwind config export.

---

## 🛠️ Step-by-Step Workflow for AI Agents

### Step 1: Emit the Semantic Content Fragment
Write *only* the semantic `<main>` content (no HTML doctype, head, CDN tags, navbar, or footer):

```html
<!-- fragment.html -->
<section class="space-y-6">
  <div class="flex flex-wrap items-center justify-between gap-3">
    <div>
      <h1 id="perf-audit" class="text-3xl font-extrabold tracking-tight">Performance Audit</h1>
      <p class="text-sm opacity-70">Automated diagnostic report</p>
    </div>
    <span class="badge badge-success font-mono font-bold">100% HEALTHY</span>
  </div>

  <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
    <div class="card bg-base-100 border border-base-300 p-4">
      <div class="text-xs uppercase opacity-70">LCP Latency</div>
      <div class="text-2xl font-bold text-primary">1.1s</div>
    </div>
    <!-- More stat cards -->
  </div>
</section>
```

### Step 2: Run the Unified Harness
Execute the single-command deterministic FSM harness:

```bash
# Standalone execution (validates, auto-fixes, compiles, and verifies):
node skills/html-report/scripts/harness.mjs run fragment.html --title "Performance Audit"

# Or caller-aware execution with custom theme and PDF export:
node skills/html-report/scripts/harness.mjs run fragment.html \
  --caller debug-optimize-lcp \
  --title "LCP Diagnostic Report" \
  --theme nord \
  --pdf
```

### Step 3: Done!
Your report is compiled in <100ms to `./report.html` (or `./report-<caller>.html`), verified across viewports, theme-synced, and ready to share or view!

---

## 🔄 Single-Tab Live-Reload Dev Server

Serve and iterate on any report in real time:

```bash
node skills/html-report/scripts/serve-report.mjs report.html --port 3000
```

- **Auto-Open**: Automatically launches the report in your default browser.
- **Single-Tab Sync**: When you recompile or edit the file:
  - If open, it seamlessly refreshes the existing tab in place (zero duplicate tabs).
  - If closed, it re-opens a fresh browser tab automatically.

---

## 📁 Repository Structure

```text
html-report/
├── skills/
│   └── html-report/                              # Canonical Agent Skill
│       ├── SKILL.md                              # Main agent instructions
│       ├── assets/
│       │   ├── template-shell.html               # Pre-bundled DaisyUI shell & navbar
│       │   └── report-runtime.js                 # Theme resolver, TOC, OKLCH canvas sync
│       ├── scripts/
│       │   ├── harness.mjs                       # Zero-dep FSM Lifecycle Harness (<2ms)
│       │   ├── build-report.mjs                  # Deterministic Compiler (<100ms)
│       │   ├── caller-registry.mjs               # Caller profiles & ephemeral run vault
│       │   └── serve-report.mjs                  # Single-tab live reload dev server
│       ├── references/
│       │   ├── architecture-and-styling.md       # 11-CDN stack & styling rules
│       │   ├── charts-and-mermaid-style-guide.md # Chart.js & Mermaid theme standards
│       │   └── harness-architecture.md           # FSM states & remediation protocol
│       ├── examples/
│       │   ├── example.html                      # Complete 11-CDN showcase
│       │   └── example.csv                       # Interactive CSV demo dataset
│       └── playwright/
│           ├── package.json                      # Playwright test dependencies
│           └── verify-report.mjs                 # 5-breakpoint responsive & PDF verifier
├── .agents/skills/html-report -> skills/html-report # Universal local symlink
├── index.html                                    # Live GitHub Pages Showcase
└── tests/                                        # 92 unit & integration tests
```

---

## 🧪 Testing

Run the comprehensive test suite (all 92 unit and integration tests run in ~500ms):

```bash
node --test tests/*.test.mjs
```

---

## 📄 License

MIT. Built with [OpenSpec](https://github.com/Fission-AI/OpenSpec) for the global AI agent ecosystem.
