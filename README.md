<div align="center">

# ⚡ html-report

**Publication-grade, interactive, and print-ready HTML5 reports for AI coding agents.**  
Generate theme-adaptive dashboards with **~70% fewer tokens** and **<100ms compilation**.

[Live GitHub Pages Showcase](https://driesverb.github.io/html-report/) · [Quickstart](#-quickstart-in-30-seconds) · [Key Features](#-key-features) · [Documentation Hub](#-documentation-hub) · [License](#-license)

<br/>

[![Live Demo](https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-success.svg?logo=github&style=flat-square)](https://driesverb.github.io/html-report/)
[![SemVer: 2.0.0](https://img.shields.io/badge/SemVer-2.0.0-blue.svg?logo=semver&style=flat-square)](docs/semantic-versioning.md)
[![Version: v1.0.0](https://img.shields.io/badge/Version-v1.0.0-orange.svg?style=flat-square)](package.json)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)
[![Agent Skill: LLM-Agnostic](https://img.shields.io/badge/Agent%20Skill-LLM--Agnostic-blueviolet.svg?style=flat-square)](https://agentskills.io)
[![CDN Stack: 17 Libraries](https://img.shields.io/badge/CDN%20Stack-17%20Libraries-3b82f6.svg?style=flat-square)](docs/cdn-stack.md)
[![Verified: 276 Tests Passing](https://img.shields.io/badge/Verified-276%20Tests%20Passing-2ea44f.svg?style=flat-square)](docs/testing-and-verification.md)

</div>

---

> 🌐 **Live GitHub Pages Showcase:** [https://driesverb.github.io/html-report/](https://driesverb.github.io/html-report/)  
> Works natively with **Antigravity, Claude Code, Cursor, Codex, OpenCode, Gemini CLI**, and autonomous agent pipelines.

---

## 🚀 Quick Install

### Option A: Install as an Agent Prompt (Recommended)

Copy and paste this single prompt directly into your AI coding assistant:

```text
Install the html-report skill from https://github.com/DriesVerb/html-report.git by cloning it into ~/.agents/html-report, symlinking ~/.agents/html-report/skills/html-report into ~/.agents/skills/html-report (and ~/.gemini/config/skills/html-report if using Antigravity/Gemini), and installing Playwright in ~/.agents/html-report/skills/html-report/playwright. Then read skills/html-report/SKILL.md.
```

### Option B: 1-Line Terminal Command

```bash
git clone https://github.com/DriesVerb/html-report.git ~/.agents/html-report && \
  mkdir -p ~/.agents/skills ~/.gemini/config/skills && \
  ln -sfn ~/.agents/html-report/skills/html-report ~/.agents/skills/html-report && \
  ln -sfn ~/.agents/html-report/skills/html-report ~/.gemini/config/skills/html-report
```

---

## 💡 Why `html-report`?

When LLMs generate full HTML documents from scratch, they waste **70% to 80% of their output tokens** on boilerplate: doctypes, CDN imports, CSS resets, repetitive navbars, and theme glue. Worse, models frequently hallucinate broken CDN links, omit heading IDs, and cause mobile layout overflow.

`html-report` replaces fragile generation with a **deterministic build harness**:
- **Agents emit only the semantic content fragment** (headings, metric cards, charts, diagrams, tables).
- The **deterministic harness** validates, auto-fixes, and stitches the fragment into a pre-bundled shell in **<100ms**.

| Metric | Traditional LLM Generation | With `html-report` | Advantage |
| :--- | :--- | :--- | :--- |
| **Output Tokens** | ~2,500+ tokens | **~500–800 tokens** | **~70% token savings** |
| **Assembly Latency** | 10–25s | **<100ms** | **100x faster execution** |
| **Pre-Flight Repairs** | 1+ LLM turn (5–10s) | **<1ms** mechanical auto-fix | **Zero token burn for trivial fixes** |
| **Layout Assurance** | Manual browser inspection | **<4s** Playwright check | **Instant responsive confidence** |

---

## ⚡ Quickstart in 30 Seconds

### 1. Write a Semantic Fragment

Write *only* the semantic content (no `<!DOCTYPE>`, `<html>`, or `<head>`):

```html
<!-- fragment.html -->
<section class="space-y-6">
  <div class="flex flex-wrap items-center justify-between gap-3">
    <h1 id="audit-summary" class="text-3xl font-extrabold tracking-tight">System Health Audit</h1>
    <span class="badge badge-success font-mono font-bold">ALL SYSTEMS NORMAL</span>
  </div>

  <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
    <div class="card bg-base-100 border border-base-300 p-4">
      <div class="text-xs uppercase opacity-70">Uptime</div>
      <div class="text-2xl font-bold text-primary">99.99%</div>
    </div>
    <div class="card bg-base-100 border border-base-300 p-4">
      <div class="text-xs uppercase opacity-70">LCP Latency</div>
      <div class="text-2xl font-bold text-success">1.05s</div>
    </div>
    <div class="card bg-base-100 border border-base-300 p-4">
      <div class="text-xs uppercase opacity-70">Active Swarms</div>
      <div class="text-2xl font-bold text-accent">12</div>
    </div>
  </div>
</section>
```

### 2. Compile via the FSM Harness

```bash
node skills/html-report/scripts/harness.mjs run fragment.html --title "System Health Audit"
```

Your report is compiled in `<100ms` into `./report.html`.

### 3. Live Preview & Iterate

```bash
node skills/html-report/scripts/serve-report.mjs report.html --port 3000
```

Refreshes your existing browser tab instantly whenever you recompile (zero duplicate tabs).

---

## ✨ Key Features

- 📱 **Instant Progressive Web Apps (PWA)**: Turn any report into an installable desktop/mobile app with offline Service Worker caching, dynamic DaisyUI theme-color sync, and native install prompt affordances (`--pwa` or `generate-pwa.mjs`).
- 📲 **1-Click Studio & PWA Installer (`/html-install`)**: Package and install the interactive Creation Studio (`create.html`) or any report as an offline-first desktop application on port 3030 (`npm run install:wizard` or `./skills/html-report/scripts/install-pwa.sh`).
- ⚡ **<100ms Deterministic Compilation**: Stitches semantic fragments into a pre-bundled publication shell.
- 🎨 **32 DaisyUI Themes + Custom OKLCH**: Sticky navbar theme switcher synced live with Chart.js, Mermaid, and Grid.js via Ottosson matrix math.
- 📦 **17-Library Non-Blocking CDN Stack**: Chart.js, Mermaid, Leaflet maps, Grid.js tables, KaTeX math, Marked, Highlight.js, FullCalendar, and more.
- 🛡️ **Cryptographic SRI & Hardened CSP**: All assets verified via SHA-384 hashes with strict Content Security Policy.
- 📡 **Real-Time Datastar SSE Telemetry**: Stream live task checklist morphs (`#task-${id}`) and tool execution feeds without page reloads.
- 📱 **5-Breakpoint Playwright Verification**: Automated layout auditing detecting horizontal overflow (`scrollWidth > clientWidth`).

---

## 📚 Documentation Hub

Explore in-depth guides in the [`docs/`](docs/) directory:

| Guide | Description |
| :--- | :--- |
| [🚀 **Getting Started**](docs/getting-started.md) | Agent prompt setup, CLI installation, and symlinks |
| [🛡️ **FSM Architecture**](docs/architecture-fsm.md) | 10-state deterministic lifecycle, pre-flight auto-fixes, and bounded retries |
| [📦 **CDN Power Stack**](docs/cdn-stack.md) | Complete 17-library catalog, SRI integrity hashes, and offline bundling |
| [🎨 **Custom Themes**](docs/custom-themes.md) | Pure JS OKLCH engine, theme inheritance (`extends`), and collapsible studio |
| [📡 **Live Telemetry**](docs/live-telemetry.md) | Datastar.js SSE hypermedia streaming and agent transcript tailing |
| [🧪 **Testing & Verification**](docs/testing-and-verification.md) | Native BDD micro-framework, Playwright checks, and overflow detection |
| [📖 **API & CLI Reference**](docs/api-and-cli-reference.md) | Command-line flags, options, and programmatic Node.js API |
| [🏷️ **Semantic Versioning**](docs/semantic-versioning.md) | SemVer 2.0.0 policy, public API boundaries, and stability contract |
| [🔄 **Migration Hub**](MIGRATION.md) | Breaking change guides, compatibility checker, and AI refactoring prompts |

---

## 🏷️ Semantic Versioning & Downstream Integration

`html-report` adheres strictly to **[Semantic Versioning 2.0.0](docs/semantic-versioning.md)** (`MAJOR.MINOR.PATCH`).
When including `html-report` in other libraries, CLI toolchains, or AI agent harnesses, you are protected by formal stability contracts:

- **Public API Stability**: Guaranteed stability across CLI flags, programmatic ESM exports (`html-report/build`, `html-report/harness`, `html-report/serve`, `html-report/pwa`, `html-report/theme`), and template slot contracts.
- **Breaking Change AI Migration Prompts**: Every breaking release includes a turnkey `<AI_MIGRATION_PROMPT>` inside [`MIGRATION.md`](MIGRATION.md) and [`docs/migrations/`](docs/migrations/) so coding agents can upgrade downstream consumer code in one prompt.
- **Pre-Flight Compatibility Scanner**:
  ```bash
  node skills/html-report/scripts/harness.mjs --check-compatibility
  ```
- **Report Footer Versioning**: Every generated report displays its exact SemVer version number in the footer (`v1.0.0`).

---

## 🧪 Verification

Run the full suite of 276+ unit, integration, and BDD tests in ~2 seconds:

```bash
node --test tests/*.test.mjs
```

---

## 📄 License

Distributed under the **MIT License**. Built with [OpenSpec](https://github.com/Fission-AI/OpenSpec) for the global AI agent ecosystem.
