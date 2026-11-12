---
name: html-dashboard
description: >-
  Generates real-time, live-streaming agent monitoring dashboards, hypermedia telemetry
  consoles, and reactive SSE interfaces using Datastar.js and the two-way AI Agent Bridge.
  Use when the user asks for live dashboards, real-time agent telemetry, SSE streaming,
  monitoring consoles, swarm visualizers, or interactive agent control loops.
---

# Live Telemetry & Real-Time Dashboard Skill (`html-dashboard`)

> **Domain:** `Delivery Archetype` | **Beneficiary:** `Hybrid` | **Serving:** `Server-Connected` | **Behavior:** `Interactive / Reactive`

This specialized skill builds reactive, live-updating monitoring consoles and multi-agent telemetry interfaces using **Datastar.js Server-Sent Events (SSE)** and the **Universal Two-Way Agent Bridge**.

Instead of heavy frontend frameworks or full-page polling, this architecture streams targeted HTML morphs directly over persistent SSE connections without page reloads.

---

## Core Hypermedia Patterns

### 1. Datastar Reactive Signals & SSE Morphs
The shared runtime includes `@starfederation/datastar@1.0.0-beta.9`:
- **Declare Reactive State**: Attach signals to root elements:
  ```html
  <div data-signals="{ activeFilter: 'all', streamConnected: true, tick: 0 }">
  ```
- **Live Fragment Morphs**: Backend SSE emits surgical DOM updates by ID:
  ```text
  event: datastar-merge-fragments
  data: fragments <div id="kpi-token-rate" class="stat-value text-primary">48.2 tok/s</div>
  ```
- **Post-Morph Icon Rehydration**: Lucide icons inside dynamic fragments automatically re-render via runtime `MutationObserver`.

### 2. Live Agent Telemetry Layout Structure
A standard live telemetry dashboard comprises three essential zones:
1. **Multi-Agent Swarm Hierarchy (`#agent-swarm-hierarchy`)**:
   Shows orchestrator and child subagents (`invoke_subagent`) with real-time status pills (`Running`, `Waiting`, `Completed`).
2. **Interactive Tool Call Feed (`#tool-call-feed`)**:
   Chronological event stream with stopwatches, collapsible terminal drawers (`mockup-code`), and side-by-side diffs.
3. **Context Window Saturation Gauge (`#context-telemetry`)**:
   Radial progress meters and token velocity counters (`tokens/sec`).

### 3. Bidirectional Agent Co-Pilot Bridge
Connects the browser UI to the active agent CLI session via `window.HTMLReportAgent`:
- Query agent from custom widgets:
  ```javascript
  const response = await window.HTMLReportAgent.ask("Explain sudden token spike", { persona: "debugger" });
  ```
- Dev server endpoints: `GET /__agent_status__`, `POST /__agent_action__`, and `POST /api/agent/prompt`.

---

## Assembly & Verification Workflow

### Step 1: Synthesize Live Semantic `<main>` Fragment
Emit the live dashboard fragment (e.g. `dashboard-fragment.html`):
```html
<main id="report-main" class="container mx-auto px-4 py-6 space-y-6" data-signals="{ activeTab: 'stream' }">
  <!-- Live Status Hero -->
  <div class="card bg-base-100 border border-base-300 shadow-sm p-4 flex flex-row items-center justify-between">
    <div class="flex items-center gap-3">
      <span class="relative flex h-3 w-3">
        <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
        <span class="relative inline-flex rounded-full h-3 w-3 bg-success"></span>
      </span>
      <h1 class="text-xl font-bold font-mono">Agent Swarm Telemetry</h1>
    </div>
    <div id="connection-status" class="badge badge-success gap-1 text-xs">SSE Connected</div>
  </div>

  <!-- Telemetry Metrics Grid -->
  <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
    <div class="stat bg-base-100 border border-base-300 rounded-box p-4">
      <div class="stat-title text-xs">Token Velocity</div>
      <div id="stat-token-velocity" class="stat-value text-primary text-2xl font-mono">124.5/s</div>
    </div>
  </div>

  <!-- Tool Execution Feed Container -->
  <div id="tool-call-feed" class="space-y-3">
    <!-- Live fragments morph in here via SSE -->
  </div>
</main>
```

### Step 2: Assemble Live Deliverable
Compile with `--live`:
```bash
node skills/html-report/scripts/build-report.mjs \
  --title "Live Agent Dashboard" \
  --content dashboard-fragment.html \
  --live \
  --output dashboard.html
```

### Step 3: Launch Live-Streaming Dev Server
Run the dev server to stream SSE fragments and listen for agent interactions:
```bash
node skills/html-report/scripts/serve-report.mjs dashboard.html --port 3000
```

---

## Sibling Skill Routing
- **Analytical Reports & Static Charts**: Use `@html-report` (baseline report assembler).
- **Printable PDFs & Invoices**: Use `@html-print` (handles pagination and page breaks).
- **Interactive Onboarding Wizard**: Use `@html-create` (runs decision interview).
