<div align="center">

# ⚡ html-report

**Publication-grade, interactive, and print-ready HTML5 deliverables for AI coding agents.**  
Emit a tiny semantic fragment (**~70% fewer tokens**) and assemble a verified, 32-theme report in **<100ms**.

[Live GitHub Pages Showcase](https://driesverb.github.io/html-report/) · [Launch Live HTML Studio ✨](https://driesverb.github.io/html-report/studio.html) · [1-Prompt Install](#-1-prompt-agent-install) · [3-Step Agentic Loop](#-the-3-step-agentic-loop) · [5 Deliverable Skills](#-5-deliverable-skills) · [Bonus: HTML Studio](#-bonus-interactive-html-studio) · [Documentation Hub](#-documentation-hub)

<br/>

[![Live Demo](https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-success.svg?logo=github&style=flat-square)](https://driesverb.github.io/html-report/)
[![Live Studio](https://img.shields.io/badge/Bonus-HTML%20Studio-8b5cf6.svg?style=flat-square)](https://driesverb.github.io/html-report/studio.html)
[![SemVer: 2.0.0](https://img.shields.io/badge/SemVer-2.0.0-blue.svg?logo=semver&style=flat-square)](docs/semantic-versioning.md)
[![Version: v0.0.0-beta.1](https://img.shields.io/badge/Version-v0.0.0--beta.1-orange.svg?style=flat-square)](package.json)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)
[![Agent Skill: LLM-Agnostic](https://img.shields.io/badge/Agent%20Skill-LLM--Agnostic-blueviolet.svg?style=flat-square)](https://agentskills.io)

</div>

---

> 🌐 **Live Showcase:** [driesverb.github.io/html-report](https://driesverb.github.io/html-report/) · ✨ **Bonus Live Studio:** [driesverb.github.io/html-report/studio.html](https://driesverb.github.io/html-report/studio.html)  
> Built for **Antigravity, Claude Code, Cursor, Codex, OpenCode, Gemini CLI**, and autonomous agent workflows.

---

## 🚀 1-Prompt Agent Install

### Option A: Paste into Your AI Agent (Recommended)

```text
Install the html-report skill from https://github.com/DriesVerb/html-report.git by cloning it into ~/.agents/html-report, symlinking ~/.agents/html-report/skills/html-report into ~/.agents/skills/html-report (and ~/.gemini/config/skills/html-report if using Antigravity/Gemini), and installing Playwright in ~/.agents/html-report/skills/html-report/playwright. Then read skills/html-report/SKILL.md.
```

### Option B: 1-Line Terminal Setup

```bash
git clone https://github.com/DriesVerb/html-report.git ~/.agents/html-report && \
  mkdir -p ~/.agents/skills ~/.gemini/config/skills && \
  ln -sfn ~/.agents/html-report/skills/html-report ~/.agents/skills/html-report && \
  ln -sfn ~/.agents/html-report/skills/html-report ~/.gemini/config/skills/html-report
```

---

## 💡 Why `html-report`? (The Agentic Advantage)

When LLMs write full HTML files from scratch, **70–80% of output tokens** vanish into `<!DOCTYPE>`, CDN links, navbars, CSS resets, and theme plumbing—often introducing broken links or mobile overflow. With `html-report`, your agent writes **only semantic content**; the deterministic Node engine builds and verifies the rest.

| Metric | Raw LLM HTML Generation | With `html-report` | Agentic Advantage |
| :--- | :--- | :--- | :--- |
| **Output Tokens** | ~2,500+ tokens | **~500–800 tokens** | **~70% token savings** |
| **Assembly Speed** | 10–25s streaming | **<100ms** | **Deterministic build & auto-detected CDNs** |
| **Pre-Flight Fixes** | Extra LLM turn | **<1ms** mechanical repair | **Zero token burn on IDs & tables** |
| **Visual QA** | Manual inspection | **<4s** Playwright check | **5-breakpoint overflow assurance** |

---

## ⚡ The 3-Step Agentic Loop

1. **Emit Only Semantic HTML (`fragment.html`)** — No `<!DOCTYPE>`, `<head>`, or CDN tags. Just headings, KPI cards, charts, Mermaid diagrams, or tables:
   ```html
   <main id="report-main" class="space-y-6">
     <h1 id="audit-summary" class="text-3xl font-extrabold">System Health Audit</h1>
     <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
       <div class="stat bg-base-100 border border-base-300 rounded-box">
         <div class="stat-title">Uptime</div><div class="stat-value text-primary">99.99%</div>
       </div>
     </div>
   </main>
   ```
2. **Assemble & Verify in `<100ms`** — Auto-detects only the CDNs your fragment uses, applies 32 DaisyUI themes, and validates structure:
   ```bash
   node skills/html-report/scripts/harness.mjs run fragment.html --title "System Health Audit"
   ```
3. **Live Preview & Two-Way Visual Edit Mode** — Serve locally with zero-reload hot-swapping, click any element in the browser to tweak styles, or send a surgical edit prompt back to your agent:
   ```bash
   node skills/html-report/scripts/serve-report.mjs report.html --port 3031
   ```

---

## 🎯 5 Deliverable Skills

Invoke any specialized skill directly in your AI assistant for tailored layouts and build flags:

| Skill | Output Archetype | Key Capability | Guide |
| :--- | :--- | :--- | :--- |
| **`/html-report`** | Analytical Reports | Auto-detected Chart.js, Mermaid, Grid.js, KaTeX, Leaflet & 32 themes | [SKILL.md](skills/html-report/SKILL.md) |
| **`/html-dashboard`** | Live Telemetry Consoles | Datastar.js SSE morphing (`#task-${id}`) & Two-Way AI Agent Bridge | [SKILL.md](skills/html-dashboard/SKILL.md) |
| **`/html-presentation`** | Interactive Slide Decks | Reveal.js decks with Fullscreen (`F`), Speaker Notes (`N`) & print stack | [SKILL.md](skills/html-presentation/SKILL.md) |
| **`/html-print`** | Paged PDFs & Invoices | `@page` margins, repeating `<thead>`, `break-inside-avoid` & PDF export | [SKILL.md](skills/html-print/SKILL.md) |
| **`/html-pwa`** | Offline Installable Apps | W3C manifest, dual-caching Service Worker & theme-color sync (`--pwa`) | [SKILL.md](skills/html-pwa/SKILL.md) |

---

## 🎁 Bonus: Interactive HTML Studio (`/html-studio`)

As a **bonus visual companion** (`@html-report/studio`), `html-studio` helps humans and agents configure deliverables interactively with **zero Node.js required**:

- **Live Browser Studio (GitHub Pages):** **[https://driesverb.github.io/html-report/studio.html](https://driesverb.github.io/html-report/studio.html)** ([Direct `create.html`](https://driesverb.github.io/html-report/packages/studio/assets/create.html))
- **Local Instant Launch (`<250ms`):** Run `./skills/html-report/scripts/open-create.sh` or ask your agent for **`/html-studio`** ([SKILL.md](skills/html-studio/SKILL.md))
- **What's Inside:** 4-step archetype & addon wizard, real-time OKLCH custom theme designer, Quill WYSIWYG goals modal, workspace project scanner, and deterministic prompt/CLI generator.

---

## 📚 Documentation Hub

| Guide | Covers |
| :--- | :--- |
| [🚀 **Getting Started**](docs/getting-started.md) | Agent prompt setup, CLI installation, and symlinks |
| [🛡️ **FSM Architecture**](docs/architecture-fsm.md) | 10-state deterministic lifecycle, pre-flight auto-fixes, and bounded retries |
| [📦 **CDN Power Stack**](docs/cdn-stack.md) | Complete 17-library catalog, SRI integrity hashes, and offline bundling |
| [🎨 **Custom Themes**](docs/custom-themes.md) | Pure JS OKLCH engine, theme inheritance (`extends`), and collapsible studio |
| [📡 **Live Telemetry**](docs/live-telemetry.md) | Datastar.js SSE hypermedia streaming and agent transcript tailing |
| [🧪 **Testing & Verification**](docs/testing-and-verification.md) | Native BDD micro-framework, Playwright checks, and overflow detection |
| [📖 **API & CLI Reference**](docs/api-and-cli-reference.md) | Command-line flags, options, and programmatic Node.js API |
| [🗺️ **Codebase Map**](docs/codebase-map.md) | Monorepo package boundaries (`@html-report/core`, `@html-report/studio`) |

---

## 🏷️ Semantic Versioning & Downstream Integration

`html-report` adheres strictly to **[Semantic Versioning 2.0.0](docs/semantic-versioning.md)** (`MAJOR.MINOR.PATCH`), providing stable CLI flags, ESM exports (`html-report/build`, `html-report/harness`, `html-report/serve`, `html-report/pwa`, `html-report/theme`), compatibility scanning (`node skills/html-report/scripts/harness.mjs --check-compatibility`), and AI migration prompts in [`MIGRATION.md`](MIGRATION.md).

---

## 🧪 Verification & 📄 License

Run the workspace unit & integration suite (`npm test`) or E2E Playwright checks (`npm run test:e2e`).  
Distributed under the **MIT License**. Built with [OpenSpec](https://github.com/Fission-AI/OpenSpec) for the AI agent ecosystem.
