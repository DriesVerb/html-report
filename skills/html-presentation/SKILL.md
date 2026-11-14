---
name: html-presentation
description: >-
  Generates executive pitch decks, interactive slide presentations, and structured keynotes
  using Reveal.js slide transitions and DaisyUI styling. Use when the user asks for
  slide decks, presentations, pitches, slides, or keynote overviews.
---

# Interactive Slide Deck Skill (`html-presentation`)

> **Domain:** `Delivery Archetype` | **Beneficiary:** `User-Facing` | **Serving:** `Static File` | **Behavior:** `Interactive / Reactive`

Specialized skill producing interactive slide presentations, pitches, and structured decks using **Reveal.js** (`embedded: true`, `disableLayout: true`) combined with Tailwind CSS and DaisyUI 32-theme styling.

> **[Reveal.js Presentation Style Guide](../html-report/references/reveal-presentation-style-guide.md)**: Required reference for `#presentation-shell`, `.slide-body` specificity rules, multi-mode spacing tokens (`--slide-pad-x`, `--slide-pad-top`, `--slide-pad-bottom`), Fullscreen (`F`), follow-along Speaker Notes (`N`), and Chart.js / Leaflet / Mermaid sizing.

---

## Reveal.js Presentation Standards

### 1. Slide Deck Structure
Wrap slides in `#presentation-shell` and `.reveal-stage > .reveal#presentation-deck > .slides > section`, placing flex layout inside `<div class="slide-body">`. Never put `p-10` directly on `<section>`, so multi-mode spacing tokens and safe-zone clearances hold across Embedded, Fullscreen, Stacked, and Print modes:
```html
<main id="report-main" class="container mx-auto px-4 py-8 space-y-6">
  <section id="presentation-shell" class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-2xl sm:text-3xl font-extrabold tracking-tight">Autonomous Agent Systems</h1>
      <div class="flex items-center gap-2 print:hidden">
        <button id="presentation-notes-btn" type="button" class="btn btn-outline btn-sm">Notes N</button>
        <button id="presentation-stack-btn" type="button" class="btn btn-outline btn-sm">All Slides</button>
        <button id="presentation-fullscreen-btn" type="button" class="btn btn-primary btn-sm">Present F</button>
      </div>
    </div>
    <div class="reveal-stage">
      <div class="reveal" id="presentation-deck">
        <div class="slides">
          <section data-notes="Fallback short note cue.">
            <div class="slide-body justify-center">
              <h2 class="text-4xl font-black text-primary">Slide 1</h2>
              <p class="text-lg text-base-content/70">Architecture overview.</p>
            </div>
            <aside class="notes"><p>Rich speaker talking points.</p></aside>
          </section>
          <section>
            <section><div class="slide-body"><h2>Deep Dive</h2></div></section>
            <section><div class="slide-body"><h3>Sub-Slide</h3></div></section>
          </section>
        </div>
      </div>
    </div>
  </section>
</main>
```

### 2. Modes & Controls
- **Presentation Mode**: `--presentation` or `--mode presentation` activates Reveal.js keyboard navigation (`←`/`→`/`↑`/`↓`/`Space`), **`F`** Fullscreen toggle (`#presentation-shell`), **`N`** follow-along Speaker Notes (`#presentation-notes-modal`), and **All Slides** stacked toggle (`.is-stacked`).
- **Legacy 3D Decks**: Pass `--impress` explicitly only when targeting legacy spatial `#impress` canvases.
- **Print & DaisyUI**: Slides stack cleanly in print (`break-inside: avoid`) and adapt to all 32 DaisyUI themes.

---

## Assembly & Verification Workflow

```bash
# 1. Scaffold or build Reveal.js presentation deck
node skills/html-report/scripts/build-report.mjs \
  --title "Autonomous Agents 2026" \
  --content slides-fragment.html \
  --presentation --theme night --output deck.html

# 2. Verify spacing, safe zones, fullscreen, and notes in Playwright
node skills/html-report/playwright/verify-report.mjs deck.html --mode presentation --cdn-reveal

# 3. Preview on local dev server (default port 3031, fallback 3032)
node skills/html-report/scripts/serve-report.mjs deck.html --port 3031 --no-open
```

---

## Sibling Skill Routing
- **Analytical Reports & BI**: Use `@html-report`
- **Paged Documents & PDFs**: Use `@html-print`
- **Real-Time Telemetry**: Use `@html-dashboard`
- **Studio Onboarding**: Use `@html-create`
