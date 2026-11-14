# Reveal.js Presentation Style Guide (`html-presentation`)

> Authoritative design, layout, speaker-notes, and widget integration contract for Reveal.js (`@html-presentation`) slide decks compiled with `build-report.mjs --mode presentation` and `scaffold-project.mjs --mode presentation`.

---

## 1. Architecture: `#presentation-shell` & Embedded Mode (`embedded: true`, `disableLayout: true`)

Presentations run inside the shared DaisyUI `template-shell.html` container rather than taking over the entire `<body>` blindly. To guarantee pixel-accurate Tailwind CSS, DaisyUI 32-theme tokens, and zero viewport clipping:

1. **Shell Root (`#presentation-shell`)**: Every deck MUST wrap its toolbar, Reveal stage, HUD, and modeless notes modal inside `<div id="presentation-shell">`. Fullscreen targets `#presentation-shell` (via native Fullscreen API with automatic `.is-fullscreen` `100vw × 100dvh` fallback), keeping overlays, HUD buttons, and speaker notes visible inside fullscreen.
2. **Embedded Initialization**: `report-runtime.js` initializes Reveal.js with **`embedded: true`** and **`disableLayout: true`**:
   - Disables Reveal's legacy inline `transform: scale(...)` and calculated pixel `top`/`width` positioning on `<section>`, which would otherwise distort Tailwind spacing, crisp vector text, Chart.js canvases, and Leaflet map coordinates.
   - Enables natural flexbox layout inside every `<section>` while keeping Reveal.js keyboard navigation (`←`/`→`/`↑`/`↓`/`Space`), progress bar, slide numbering (`c/t`), hash/history tracking, and vertical sub-slide stacks.

```html
<section id="presentation-shell" class="space-y-4">
  <div class="flex flex-wrap items-center justify-between gap-3">
    <div class="space-y-1">
      <div class="badge badge-primary badge-outline text-xs font-bold">Executive Presentation</div>
      <h1 class="text-2xl sm:text-3xl font-extrabold tracking-tight">Deck Title</h1>
    </div>
    <div class="flex flex-wrap items-center gap-2 print:hidden">
      <button id="presentation-notes-btn" type="button" class="btn btn-outline btn-sm gap-1.5" aria-expanded="false">
        <i data-lucide="sticky-note" class="w-4 h-4"></i>
        <span>Notes <kbd class="kbd kbd-xs">N</kbd></span>
      </button>
      <button id="presentation-stack-btn" type="button" class="btn btn-outline btn-sm gap-1.5">
        <i data-lucide="rows-3" class="w-4 h-4"></i>
        <span>All Slides</span>
      </button>
      <button id="presentation-fullscreen-btn" type="button" class="btn btn-primary btn-sm gap-1.5">
        <i data-lucide="maximize-2" class="w-4 h-4"></i>
        <span>Present <kbd class="kbd kbd-xs">F</kbd></span>
      </button>
    </div>
  </div>

  <div class="reveal-stage">
    <div class="reveal" id="presentation-deck">
      <div class="slides">
        <section>
          <div class="slide-body">
            <!-- Slide content goes here -->
          </div>
          <aside class="notes">
            <p>Speaker talking points...</p>
          </aside>
        </section>
      </div>
    </div>
  </div>
</section>
```

---

## 2. Multi-Mode Spacing Tokens & `.slide-body` Specificity Contract

### Never Put Padding Classes (`p-10`, `px-8`) Directly on `<section>`
Because `reveal.css` declares `.reveal .slides section { padding: 20px 0; }` AFTER Tailwind's utilities or collides during cascade transitions, utility classes like `p-10` on `<section>` are fragile. Instead:

1. Keep padding and safe-zone clearance on the Reveal stage tokens (`--slide-pad-x`, `--slide-pad-top`, `--slide-pad-bottom`, `--slide-gap`).
2. Wrap inner slide content inside `<div class="slide-body">` (`min-h-full w-full max-w-6xl mx-auto flex flex-col gap-[var(--slide-gap)]`).
3. Vertical stacks (`<section>` containing child `<section>` sub-slides) automatically zero out outer section padding via `.reveal .slides > section:has(> section)` so child sub-slides receive the full spacing budget without double padding.

### Multi-Mode Spacing Matrix

| Mode | `--slide-pad-x` | `--slide-pad-top` | `--slide-pad-bottom` | Behavior |
| :--- | :--- | :--- | :--- | :--- |
| **Embedded** (default card) | `clamp(1.75rem, 3.5vw, 3.5rem)` | `clamp(1.5rem, 3vh, 2.75rem)` | `max(3.75rem, 5.5vh)` (`>= 52px`) | Clears `.controls`, `.slide-number`, `.progress` |
| **Fullscreen** (`#presentation-shell:fullscreen` / `.is-fullscreen`) | `clamp(2.5rem, 5vw, 5.5rem)` | `clamp(2rem, 4vh, 3.75rem)` | `max(4.5rem, 7vh)` | Centers `.slide-body` within `max-w-6xl`; reveals `#presentation-fullscreen-hud` |
| **All Slides / Stacked** (`.is-stacked`) | `2rem` | `1.75rem` | `1.75rem` | Displays every horizontal and vertical slide as a stacked card with clear separation |
| **Print** (`@media print`) | `1.5rem` | `1.5rem` | `1.5rem` | Renders all slides vertically with `break-inside: avoid` |

---

## 3. Content & Typography Density Budgets

- **One Core Idea Per Slide**: Limit each slide to 1 primary thesis and at most 2 visual columns (`grid-cols-1 lg:grid-cols-2 gap-6`).
- **Bullet Discipline**: 3–5 concise bullets (`<= 14 words` each). Never drop walls of prose into a slide; push supporting detail to vertical sub-slides (`<section><section>Overview</section><section>Deep Dive</section></section>`) or `<aside class="notes">`.
- **Safe-Zone Protection**: Never add fixed `height: 1000px` boxes inside a slide. Every `<section>` MUST fit comfortably (`section.scrollHeight <= section.clientHeight + 2` at `1280×800` and `1440×900`) with at least `52px` of bottom safe-zone clearance above Reveal `.controls` and `.slide-number`.

---

## 4. Follow-Along Speaker Notes & Fullscreen Shortcuts

Presenters rely on two modeless controls automatically wired by `report-runtime.js`:

- **`F` key / `#presentation-fullscreen-btn`**: Enters fullscreen on `#presentation-shell`, exits `.is-stacked` if active, renders `#presentation-fullscreen-hud` (Prev, Next, Slide Counter, Notes toggle, Exit), and triggers `reveal.layout()`, Chart.js `.resize()`, and Leaflet `invalidateSize()`. Press **`Esc`** or click Exit to leave fullscreen.
- **`N` key / `#presentation-notes-btn`**: Opens `#presentation-notes-modal` (`role="dialog" aria-modal="false"`).
  - Stays open and modeless as you navigate slides (`←` / `→` / `↑` / `↓` / `Space`).
  - Supports **dock positions** (`Bottom Right`, `Bottom Left`, `Right Panel`) and font-size toggles (`A-` / `A+`).
  - Reads `<aside class="notes">...</aside>` (sanitized rich HTML lists, bolding, code, links) first, falling back to `data-notes="..."`, and renders an **"Up Next"** preview of the following slide.

```html
<section data-notes="Fallback short cue when aside.notes is omitted">
  <div class="slide-body justify-between">
    ...
  </div>
  <aside class="notes">
    <ul>
      <li><strong>Lead with outcome:</strong> 38% reduction in turn-around time.</li>
      <li>Point to the Southeast cluster on Slide 3 map.</li>
    </ul>
  </aside>
</section>
```

---

## 5. Embedded Widgets: Chart.js, Leaflet & Mermaid

- **Chart.js Canvases**: Wrap `<canvas>` in `<div class="relative w-full h-56 sm:h-64">` and register instances on `window.reportCharts` so `resizePresentationWidgets()` automatically calls `.resize()` when switching into previously hidden slides or fullscreen.
- **Leaflet Maps**: Give the map container an explicit height (`h-64 sm:h-72 rounded-xl overflow-hidden`). `template-shell.html` caps `.leaflet-container` at `z-index: 10` (panes/controls at `15`, well under the `z-50` sticky navbar) and allows `https://unpkg.com` in `img-src` CSP so default `L.marker()` icons work cleanly without console CSP violations. Prefer crisp `L.divIcon` markers with theme tokens (`bg-primary`, `text-primary-content`) for custom data pins.
- **Mermaid Diagrams**: Use semantic `.mermaid` blocks; keep node count concise (`<= 8` nodes per slide) so labels remain readable from across a room.
- **DaisyUI Theme Sync**: Always inherit semantic classes (`bg-base-100`, `bg-base-200`, `text-base-content`, `border-base-300`, `badge-primary`, `card`) rather than hardcoded hex backgrounds so all 32 DaisyUI themes switch seamlessly.

---

## 6. Automated Playwright Verification (`verify-report.mjs`)

Run headless verification on every presentation before delivery:

```bash
node skills/html-report/playwright/verify-report.mjs path/to/index.html --mode presentation --cdn-reveal
```

`checks/cdns/reveal.mjs` enforces:
1. Horizontal padding `>= 24px` and bottom safe-zone clearance `>= 52px` on active slides.
2. Zero vertical clipping (`scrollHeight <= clientHeight + 2`) and zero overlap with `.controls` / `.slide-number`.
3. Fullscreen toggle reflows Reveal layout without console/page errors.
4. Modeless Speaker Notes modal (`aria-modal="false"`) stays open and updates live across horizontal and vertical slide transitions.
