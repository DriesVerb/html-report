---
name: html-studio
description: >-
  Interactive onboarding decision wizard, OKLCH theme studio, and deterministic prompt
  generator for HTML reports, dashboards, presentations, and PWAs. Use when the user
  runs /html-studio or /html-studio:cli (legacy aliases /html-create and /html-create:cli
  also supported), or asks for help deciding what report type, theme, or architecture to create.
---

# Interactive Creation Studio & Skill Router (`html-studio`)

> **Domain:** `Create Mode` | **Beneficiary:** `Hybrid` | **Serving:** `Static File / Server-Connected` | **Behavior:** `Interactive`

Guides users and agents through a multi-dimensional decision wizard to select the optimal report architecture, DaisyUI theme, and deterministic execution pipeline.

---

## Slash Commands & Access Modes

### 1. `/html-studio` (Web Onboarding Studio & Theme Creator; legacy alias `/html-create`)

#### Fast Instant Launch (Recommended)
```bash
./skills/html-report/scripts/open-create.sh
# Or via Node / manual server:
node skills/html-report/scripts/open-create.mjs
node skills/html-report/scripts/serve-report.mjs packages/studio/assets/create.html --port 3031 --no-open
```
- **Streamlined Navbar & Projects Hub**: Header with Sections TOC, Projects dropdown & directory launcher (`#navbar-projects-btn`), and consolidated Settings Gear.
- **Auto Workspace Discovery (`GET /api/projects`)**: Scans workspace up to 4 levels with TTL cache, SemVer tags, and offline zero-node fallback.
- **Visual Questionnaire & Theme Studio**: 4-step wizard, real-time OKLCH DaisyUI theme generator, and 1-click agent prompt.

#### Agent Capabilities Fallback (No Node.js on Machine)
1. **Browser**: Open `file:///path/to/html-report/packages/studio/assets/create.html`.
2. **System Opener**: `xdg-open packages/studio/assets/create.html` (Linux), `open` (macOS), or `cmd.exe /c start` (Windows).
3. **Interactive Interview**: Conduct the 4-step decision interview directly via multiple-choice questions.

### 2. `/html-studio:cli` (Terminal Grill Interview; legacy alias `/html-create:cli`)
Zero-dependency interactive terminal interview outputting the exact CLI command and agent prompt:
```bash
node skills/html-report/scripts/html-grill.mjs
```

### 3. `/html-install` (1-Click PWA App Packaging)
```bash
./skills/html-report/scripts/install-pwa.sh # or: npm run install:wizard
```

### 4. Data-First Project Scaffolding (`scaffold-project.mjs --json`)
Stage CSV/JSON datasets into `projects/<slug>/refs/`, compute numeric `columnSummaries` (`sum`, `avg`, `min`, `max`), and emit pre-wired `fragment.html` + `index.html` in <100ms:
```bash
node skills/html-report/scripts/scaffold-project.mjs --project q4-audit --title "Q4 Audit" --ref data.csv --widgets kpi-row,chart-pair,grid-table --json
```

---

## Domain Decision Model

```text
Target (Report | Print | Live | Slide | PWA)
  └── Communication (Broadcast | Interactive | Real-Time)
        └── App Type (Standard HTML | Offline PWA)
              └── Theme (32 DaisyUI Themes | Custom OKLCH)
                    └── Addons (Charts, Mermaid, Leaflet, Grid.js, KaTeX)
```

### Deterministic Skill Handoff Matrix
Upon wizard completion, `html-studio` routes into the specialized sibling skill:

| User Selections | Target Sibling Skill | Required CLI Flags |
| :--- | :--- | :--- |
| Paged document, invoice, compliance PDF | `@html-print` | `--mode print --pdf` |
| Live telemetry, SSE hypermedia, agent bridge | `@html-dashboard` | `--live` (with `serve-report.mjs`) |
| Pitch deck, 3D animated slides, keynote | `@html-presentation` | `--presentation` |
| Offline-first field tool, installable app | `@html-pwa` | `--pwa` |
| Analytical summary, KPIs, BI charts, tables | `@html-report` | Standard baseline |

---

## AI Agent Prompt Synthesis Pattern
```text
Task: Build an Executive KPI Dashboard
Skill Command: /html-report (Specialized Facade: @html-report)
Objective & Scope: Weekly revenue churn alerts and regional enterprise sales quotas
Target Audience: C-Suite Leadership and Operating Committee
Deliverable Architecture:
- Purpose & Format: ANALYTICAL REPORT | Mode: STATIC_STANDALONE | Packaging: Standard Browser Page
- Startup Theme: "emerald" | Addons: Chart.js, Grid.js, Showdown
```

---

## Sibling Skills
- `@html-report`: Analytical summaries, BI metrics, Chart.js, Grid.js.
- `@html-print`: Pixel-perfect A4/Letter PDF deliverables, invoices.
- `@html-dashboard`: Live Datastar SSE hypermedia streaming.
- `@html-presentation`: Reveal.js interactive slide decks (legacy `--impress` supported).
- `@html-pwa`: Installable Progressive Web App with offline Service Worker.
