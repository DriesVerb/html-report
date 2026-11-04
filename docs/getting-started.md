# 🚀 Getting Started with `html-report`

`html-report` is an LLM-agnostic Agent Skill and deterministic build system that empowers AI coding agents (Antigravity, Claude Code, Cursor, Codex, OpenCode, Gemini CLI) to produce publication-grade, interactive, theme-adaptive, and print/PDF-ready HTML5 reports with **~70% fewer output tokens** and **<100ms compilation**.

---

## ⚡ 1-Minute Quickstart

### Method 1: Install as an Agent Prompt (Recommended)

Paste this single prompt into your AI coding assistant (Antigravity, Claude Code, Cursor, Codex, OpenCode, or Gemini CLI):

```text
Install the html-report skill from https://github.com/DriesVerb/html-report.git by cloning it into ~/.agents/html-report, symlinking ~/.agents/html-report/skills/html-report into ~/.agents/skills/html-report (and ~/.gemini/config/skills/html-report if using Antigravity/Gemini), and installing Playwright in ~/.agents/html-report/skills/html-report/playwright. Then read skills/html-report/SKILL.md.
```

Your agent will automatically clone the repository, establish symlinks, install Playwright dependencies, and read `SKILL.md`.

---

### Method 2: 1-Line Terminal Install

If installing manually from your shell:

```bash
# Clone the canonical repository:
git clone https://github.com/DriesVerb/html-report.git ~/.agents/html-report

# Create agent skills directories and symlink:
mkdir -p ~/.agents/skills ~/.gemini/config/skills
ln -sfn ~/.agents/html-report/skills/html-report ~/.agents/skills/html-report
ln -sfn ~/.agents/html-report/skills/html-report ~/.gemini/config/skills/html-report

# (Optional) Install Playwright for multi-breakpoint verification:
cd ~/.agents/html-report/skills/html-report/playwright && npm install && npx playwright install --with-deps chromium
```

---

## 💡 The Core Workflow

Traditional LLMs waste thousands of tokens writing boilerplate doctypes, CDN script tags, CSS resets, and navbars. With `html-report`, agents emit **only the semantic `<main>` content fragment**.

### Step 1: Write a Semantic Fragment

Create a file named `fragment.html` containing only your report's content:

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
    <div class="card bg-base-100 border border-base-300 p-4">
      <div class="text-xs uppercase opacity-70">CLS Score</div>
      <div class="text-2xl font-bold text-success">0.01</div>
    </div>
    <div class="card bg-base-100 border border-base-300 p-4">
      <div class="text-xs uppercase opacity-70">INP Latency</div>
      <div class="text-2xl font-bold text-accent">140ms</div>
    </div>
  </div>
</section>
```

### Step 2: Compile & Verify via the FSM Harness

Run the single-command deterministic harness:

```bash
node skills/html-report/scripts/harness.mjs run fragment.html --title "Performance Audit"
```

The harness will:
1. Validate semantic structure.
2. Auto-fix any missing `id` anchors or unadorned tables in `<1ms`.
3. Deterministically assemble the full HTML5 report into `./report.html` in `<100ms`.
4. (Optional) Run Playwright across 5 breakpoints (`sm`, `md`, `lg`, `xl`, `2xl`) to guarantee zero horizontal scrollbar overflow.

### Step 3: View & Live Iterate

Serve your report with single-tab live reload:

```bash
node skills/html-report/scripts/serve-report.mjs report.html --port 3000
```

When you update `fragment.html` and re-run the harness, your browser tab instantly refreshes in place without spawning duplicate tabs.

---

## 📚 Next Steps

- Explore the [10-State Deterministic FSM Harness](architecture-fsm.md)
- Learn about the [17-Library Non-Blocking CDN Stack](cdn-stack.md)
- Customize your color palettes with [Custom DaisyUI Themes & OKLCH Engine](custom-themes.md)
- Enable real-time LLM streaming with [Live Telemetry & Datastar.js](live-telemetry.md)
- Review the [Full CLI & API Reference](api-and-cli-reference.md)
