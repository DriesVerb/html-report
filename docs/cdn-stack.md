# 📦 The 17-Library Non-Blocking CDN Stack & Security

`html-report` features a carefully engineered, non-blocking CDN stack pre-wired for instant interactivity, cryptographic security, responsive elegance, and offline portability.

---

## 🏛️ Stack Architecture

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
│  Impress.js 1.1  — 3D Presentations (Presentation-Guarded, Print Fallback)  │
│  Mock.js 1.1     — Client-Side Synthetic Data & Schema Simulation           │
│  Showdown 2.1    — Two-Way Markdown Converter (Zero Marked Collision)       │
│  FullCalendar 6  — Interactive Scheduling Grids & Theme Palette Sync        │
│  Datastar.js 1.0 — Real-Time SSE Morphing & Reactive Signals (Idiomorph)    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📋 Complete Library Catalog & Version Matrix

| Library | Version | Loading Strategy | Purpose & Highlights |
| :--- | :--- | :--- | :--- |
| **Tailwind CSS** | Latest Play CDN | Non-blocking script | Full utility class engine across all 5 responsive breakpoints (`sm`, `md`, `lg`, `xl`, `2xl`). |
| **DaisyUI** | v4.12.14 | Stylesheet (32 Themes) | Semantic components with all 32 official themes defaulting to `light`. Custom themes fully supported. |
| **Lucide Icons** | v0.460.0 | `defer` + UMD | 1,400+ crisp SVG vector icons rendered dynamically via `data-lucide` attributes. |
| **Alpine.js** | v3.14.3 | `defer` + CDN | Declarative micro-reactivity (`x-data`, `x-model`, `@click`) for filters and UI controls. |
| **Chart.js** | v4.4.6 | `defer` + UMD | High-performance HTML5 canvas charts synchronized live with active DaisyUI theme palettes. |
| **Mermaid** | v11.4.0 | `defer` + UMD | Architecture, sequence, and entity diagrams with numbered-list syntax defense and live re-theming. |
| **Leaflet** | v1.9.4 | `defer` + UMD | Geospatial maps powered by Esri World Street tiles (zero API keys, zero `file:///` 403 errors). |
| **Grid.js** | v6.0.6 | `defer` + UMD | Interactive, sortable, searchable, and paginated tables styled for both light and dark modes. |
| **KaTeX** | v0.16.11 | `defer` + UMD | Fast scientific math and LaTeX typesetting with automatic math delimiters (`$$...$$`, `$...$`). |
| **Marked** | v14.1.3 | `defer` + UMD | Lightning-fast client-side Markdown rendering for rich prose and technical documentation. |
| **Highlight.js** | v11.10.0 | `defer` + UMD | Syntax highlighting across TypeScript, JavaScript, Kotlin, Python, Bash, and SQL code blocks. |
| **Day.js** | v1.11.13 | `defer` + UMD | 2kB immutable date parser and relative-time calculator (`[data-dayjs="now"]`, `[data-dayjs-from-now]`). |
| **Impress.js** | v1.1.0 | Presentation-Guarded | 3D step transitions for pitch decks. Strictly guarded: renders as clean printable cards by default. |
| **Mock.js** | v1.1.0 | `defer` + UMD | Client-side synthetic data simulation engine (`Mock.mock(...)` via `[data-mock]`) with 0 backend calls. |
| **Showdown** | v2.1.0 | `defer` + UMD | Two-way Markdown parser with table and strikethrough support that co-exists cleanly with Marked. |
| **FullCalendar** | v6.1.15 | `defer` + UMD | Interactive scheduling grids (month, week, list) with theme-adaptive border and accent highlights. |
| **Datastar.js** | v1.0.0-beta.9 | Module + ESM | Real-time SSE hypermedia streaming, live DOM morphing (Idiomorph), and reactive signals. |

---

## 🔒 Cryptographic Security & CSP Hardening

Every report assembled by `html-report` is hardened against supply-chain injection, unauthorized script execution, and context leakage:

1. **Subresource Integrity (SRI)**:
   External CDN stylesheets and scripts carry SHA-384 cryptographic integrity hashes:
   ```html
   <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/daisyui@4.12.14/dist/full.min.css"
         integrity="sha384-iMbeRReqpIEp0z+cPe0FZxnbV/GbGyGjDfou8Rjcr6KSJIptc245QXNVjLMtu5TR" crossorigin="anonymous" />
   ```
2. **Content Security Policy (CSP)**:
   Strict `<meta http-equiv="Content-Security-Policy">` restricting executable scripts, styles, fonts, and images to vetted CDN domains (`cdn.jsdelivr.net`, `cdn.tailwindcss.com`, `cdnjs.cloudflare.com`, `unpkg.com`, `server.arcgisonline.com`).
3. **No-Referrer Privacy Policy**:
   Includes `<meta name="referrer" content="no-referrer" />` on all templates and reports, preventing browsers from transmitting document paths, query params, or private caller IDs to external tile servers or CDNs.

---

## 📴 Offline Bundling & Standalone Inlining

For air-gapped environments or permanent archival, `html-report` supports inlining all remote CDN assets into a 100% self-contained `.html` file:

- **Build-Time Flag**: `node skills/html-report/scripts/build-report.mjs --offline --content fragment.html --output report-offline.html`
- **In-Browser Export**: Click the download icon in the sticky navbar and select **Download as HTML**. The client-side runtime fetches and packages all stylesheets and scripts into inline `<style>` and `<script>` blocks.
