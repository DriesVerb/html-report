---
name: html-presentation
description: >-
  Generates executive pitch decks, interactive slide presentations, and structured keynotes
  using Reveal.js slide transitions and DaisyUI styling. Use when the user asks for
  slide decks, presentations, pitches, slides, or keynote overviews.
---

# Interactive Slide Deck Skill (`html-presentation`)

Specialized skill producing interactive slide presentations, pitches, and structured decks using **Reveal.js** combined with Tailwind CSS and DaisyUI styling.

> [!NOTE]
> **Phase 3 Update**: Transitioned from 3D spatial canvas to **Reveal.js** for simpler authoring ergonomics, predictable 2D grid slides, markdown compatibility, touch support, and speaker notes. Extended features will be expanded in an upcoming sprint.

---

## Reveal.js Presentation Standards

### 1. Slide Deck Structure
Slides use standard semantic `<section>` blocks inside `.reveal > .slides`:
```html
<main id="report-main" class="presentation-container">
  <div class="reveal" id="presentation-deck">
    <div class="slides">
      <!-- Slide 1: Hero -->
      <section class="card bg-base-100 shadow-2xl p-10 border border-base-300">
        <h1 class="text-4xl font-black text-primary mb-4">Autonomous Agent Systems</h1>
        <p class="text-xl text-base-content/70">Engineering Architecture 2026</p>
      </section>

      <!-- Slide 2: Strategic Pillars -->
      <section class="card bg-base-100 shadow-2xl p-10 border border-base-300">
        <h2 class="text-3xl font-extrabold text-base-content mb-6">Core Pillars</h2>
        <div class="grid grid-cols-3 gap-4 text-left text-xs">
          <div class="p-4 bg-base-200/60 rounded-xl border border-base-300">
            <h3 class="font-bold text-primary mb-1">Deterministic</h3>
            <p class="text-base-content/70">Predictable CLI compilation.</p>
          </div>
          <div class="p-4 bg-base-200/60 rounded-xl border border-base-300">
            <h3 class="font-bold text-secondary mb-1">Zero-Duplication</h3>
            <p class="text-base-content/70">Shared runtime assets.</p>
          </div>
          <div class="p-4 bg-base-200/60 rounded-xl border border-base-300">
            <h3 class="font-bold text-accent mb-1">Two-Way Bridge</h3>
            <p class="text-base-content/70">Datastar SSE &amp; MCP gateway.</p>
          </div>
        </div>
        <aside class="notes">Key speaking notes for presenter.</aside>
      </section>

      <!-- Slide 3: Vertical Sub-Slide -->
      <section>
        <section class="card bg-base-100 shadow-2xl p-10 border border-base-300">
          <h2 class="text-2xl font-bold">Deep Dive</h2>
          <p class="text-sm text-base-content/70">Press &darr; for details.</p>
        </section>
        <section class="card bg-base-100 shadow-2xl p-10 border border-base-300">
          <h3 class="text-xl font-bold text-secondary">JSON-RPC over SSE</h3>
          <p class="text-xs font-mono bg-base-200 p-3 rounded mt-2">POST /mcp/messages &bull; GET /mcp/sse</p>
        </section>
      </section>
    </div>
  </div>
</main>
```

### 2. Modes & Styling
- **Presentation Mode**: `--presentation` flag activates keyboard controls (Arrows, Space, Esc, 's').
- **Print / PDF Fallback**: Uninitialized slides stack cleanly for static reading or headless PDF printing.
- **DaisyUI Harmony**: Works out-of-the-box with all 32 DaisyUI themes (`night`, `synthwave`, `luxury`, etc.).

---

## Assembly & Verification Workflow

```bash
# 1. Build Reveal.js presentation deck
node skills/html-report/scripts/build-report.mjs \
  --title "Autonomous Agents 2026" \
  --content slides-fragment.html \
  --presentation \
  --theme night \
  --output deck.html

# 2. Preview on local dev server
node skills/html-report/scripts/serve-report.mjs deck.html --port 3000
```

---

## Sibling Skill Routing
- **Analytical Reports & BI**: Use `@html-report`
- **Paged Documents & PDFs**: Use `@html-print`
- **Real-Time Telemetry**: Use `@html-dashboard`
- **Studio Onboarding**: Use `@html-create`
