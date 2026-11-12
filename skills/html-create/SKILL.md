---
name: html-create
description: >-
  Interactive onboarding decision wizard, OKLCH theme studio, and deterministic prompt
  generator for HTML reports, dashboards, presentations, and PWAs. Use when the user
  runs /html-create or /html-create:cli, or asks for help deciding what report type,
  theme, or architecture to create.
---

# Interactive Creation Studio & Skill Router (`html-create`)

> **Domain:** `Create Mode` | **Beneficiary:** `Hybrid` | **Serving:** `Static File / Server-Connected` | **Behavior:** `Interactive`

This specialized skill guides users and agents through a structured, multi-dimensional decision wizard to determine the optimal report architecture, DaisyUI theme, and deterministic execution pipeline.

---

## Slash Commands & Access Modes

### 1. `/html-create` (Web Onboarding Studio & Theme Creator)

#### Fast Instant Launch (Recommended)
Open the creation studio in milliseconds using the fast launcher script:
```bash
# Fast instant launcher (auto-detects Node.js vs No-Node):
./skills/html-report/scripts/open-create.sh

# Or via Node:
node skills/html-report/scripts/open-create.mjs
```

Or start the server manually:
```bash
node skills/html-report/scripts/serve-report.mjs create.html --port 3000
```
- **Streamlined Navbar & Projects Hub**: Header with Sections TOC, Projects dropdown & directory launcher (`#navbar-projects-btn`), and consolidated Settings Gear.
- **Auto Workspace Discovery (`GET /api/projects`)**: Scans workspace up to 4 levels with TTL cache, SemVer tags, and offline zero-node fallback.
- **Visual Questionnaire & Theme Studio**: 4-step wizard, real-time OKLCH DaisyUI theme generator, and 1-click agent prompt.

#### Agent Capabilities Fallback (No Node.js on Machine)
If Node.js is not executable, the agent leverages its native capabilities:
1. **Agent Browser Capabilities**: Open `create.html` directly via `file:///path/to/html-report/create.html`.
2. **System Desktop Opener**: Run `xdg-open create.html` (Linux), `open create.html` (macOS), or `cmd.exe /c start create.html`.
3. **Interactive Decision Interview**: If headless, conduct the 4-step interview directly via multiple-choice questions.

### 2. `/html-create:cli` (Terminal Grill Interview)
Executes a zero-dependency interactive terminal interview for CLI-first developers:
```bash
node skills/html-report/scripts/html-grill.mjs
```
Walks the user through top-down architectural decisions via terminal prompts and outputs the exact command and agent prompt.

### 3. `/html-install` (1-Click PWA App Packaging)
Package and install the creation studio as an offline-first desktop application:
```bash
./skills/html-report/scripts/install-pwa.sh
# or: npm run install:wizard
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
Upon wizard completion, `html-create` automatically routes into the exact specialized sibling skill:

| User Selections | Target Sibling Skill | Required CLI Flags |
| :--- | :--- | :--- |
| Paged document, invoice, compliance PDF | `@html-print` | `--mode print --pdf` |
| Live telemetry, SSE hypermedia, agent bridge | `@html-dashboard` | `--live` (with `serve-report.mjs`) |
| Pitch deck, 3D animated slides, keynote | `@html-presentation` | `--presentation` |
| Offline-first field tool, installable app | `@html-pwa` | `--pwa` |
| Analytical summary, KPIs, BI charts, tables | `@html-report` | Standard baseline |

---

## AI Agent Prompt Synthesis Pattern
The studio synthesizes unambiguous, structured instructions with direct sibling skill routing:
```text
Task: Build an Executive KPI Dashboard
Skill Command: /html-report (Specialized Facade: @html-report)

Objective & Scope (What the board needs to show):
Weekly revenue churn alerts and regional enterprise sales quotas

Target Audience:
C-Suite Leadership and Operating Committee

Deliverable Architecture:
- Purpose & Format: ANALYTICAL REPORT
- Operational Mode: STATIC_STANDALONE
- App Packaging: Standard Browser Page
- Startup Theme: "emerald"
- Features & Capabilities:
  • Interactive Charts (Chart.js)
  • Data Tables (Grid.js)
  • Markdown Reader (Showdown)
```

---

## Sibling Skills
- `@html-report`: Analytical summaries, BI metrics, Chart.js, Grid.js.
- `@html-print`: Pixel-perfect A4/Letter PDF deliverables, invoices.
- `@html-dashboard`: Live Datastar SSE hypermedia streaming.
- `@html-presentation`: Impress.js 3D slide transitions.
- `@html-pwa`: Installable Progressive Web App with offline Service Worker.
