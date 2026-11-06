# Proposal: Pipeline Refinement for Four Core HTML Report Capabilities

**Change ID**: `pipeline-four-core-features`  
**Current Stage**: `Planning` (Refinement & Brainstorming between Tech Lead & Product Owner)  
**Date**: 2026-11-06  
**Artifact Backlinks**:
- Architecture & Technical Design: [design.md](file:///home/eta/projects/html-report/openspec/changes/pipeline-four-core-features/design.md)
- Task Pipeline & Milestones: [tasks.md](file:///home/eta/projects/html-report/openspec/changes/pipeline-four-core-features/tasks.md)
- Delta Specs:
  - Feature 1: [specs/bidirectional-agent-loop/spec.md](file:///home/eta/projects/html-report/openspec/changes/pipeline-four-core-features/specs/bidirectional-agent-loop/spec.md)
  - Feature 2: [specs/mcp-server-bridge/spec.md](file:///home/eta/projects/html-report/openspec/changes/pipeline-four-core-features/specs/mcp-server-bridge/spec.md)
  - Feature 3: [specs/modular-skill-decomposition/spec.md](file:///home/eta/projects/html-report/openspec/changes/pipeline-four-core-features/specs/modular-skill-decomposition/spec.md)
  - Feature 4 & 4.1: [specs/html-help-wizard-domain-model/spec.md](file:///home/eta/projects/html-report/openspec/changes/pipeline-four-core-features/specs/html-help-wizard-domain-model/spec.md)

---

## 1. Executive Summary

As the publication-grade `html-report` standard matures, user needs are diverging across two major vectors:
1. **From Static Documents to Live Agent Collaborative Canvases**: Users no longer want just a post-hoc static artifact. They want an interactive cockpit where they can prompt the AI agent directly from within the report, inspect live telemetry, trigger re-computations, and have the agent morph DOM fragments in real time.
2. **From Monolithic Generation to Guided Specialization**: Users are overwhelmed by deciding whether they need a printable PDF, an Impress.js 3D deck, an offline PWA, or a Datastar SSE stream. Similarly, agent skills suffer from token bloat when loaded with a 28KB monolithic prompt.

This proposal refines four high-impact features for the upcoming pipeline:
- **Feature 1: Bidirectional HTML &harr; Agent Interactive Loop**: A user in the browser can prompt the AI agent directly from the report; the agent executes reasoning or actions and pushes live morphs or updates back to the HTML.
- **Feature 2: Two-Way Communication with MCP (Model Context Protocol)**: Exposing the report server as both an MCP Server (allowing external agents like Claude/Antigravity to inspect DOM and mutate cards) and an MCP Client Gateway (enabling dashboard widgets to query enterprise MCP tools).
- **Feature 3: Modular Skill Decomposition (Matt Pocock Pattern)**: Structuring our offerings into sharp, specialized agent skills (`html-report`, `html-print`, `html-dashboard`, `html-presentation`, `html-pwa`) atop a shared zero-duplication core engine.
- **Feature 4 & 4.1: Interactive Creation Studio & CLI "Grill-Me" Service (`/html-create` and `/html-create:cli`)**: A pre-built domain-modeled interactive questionnaire (served via HTML and CLI) that guides the user through top-down constraints, integrates the theme creator, and deterministically generates the optimal prompt and command line. **Upon completion, Feature 4 directly introduces the `html-create` skill into Feature 3's modular suite**, supporting both `/html-create` (interactive web wizard) and `/html-create:cli` (terminal interview), serving as the action-oriented creation front door for the entire family.

---

## 2. Product Owner (PO) vs. Tech Lead (TL) Brainstorm & Refinement Dialogue

### Feature 1: Two-Way HTML &harr; Agent Interactive Loop

> **Product Owner**: "Our users love the look of the generated reports, but they feel trapped in a one-way mirror. If a chart shows an unexpected drop in revenue at Q3, the user shouldn't have to switch back to terminal, re-explain the whole report, and prompt the agent manually. They want to click on Q3 or open an inline prompt bar, ask *'Why did this dip? Recalculate without cohort X'*, and watch the agent recalculate and mutate the chart in place. That is true human-agent symbiosis."

> **Tech Lead**: "Technically, we already laid the groundwork with Datastar SSE and `serve-report.mjs`'s `/__agent_action__`. But right now, `/__agent_action__` is a synchronous one-shot CLI call. To make this a true bidirectional loop, we need:
> 1. Multi-turn session memory so the agent knows what was asked before.
> 2. Streaming token response into a Datastar morph target so the UI feels instantaneous.
> 3. An in-page action dock (like a subtle floating drawer or `Cmd+K` palette) that captures element context (DOM snippets, Chart.js dataset state) and sends it over `POST /api/agent/prompt`.
> 4. A safeguard mechanism: if the agent recommends a destructive code or file change, the report must show an interactive approval card with 'Approve' / 'Deny' buttons before execution."

*Consensus*: Ship an embedded `HTMLReportAgentDock` component in `template-shell.html`, supported by a streaming endpoint on `serve-report.mjs` with session state caching and element context capture.

---

### Feature 2: Two-Way Communication with MCP (Model Context Protocol) Server

> **Product Owner**: "MCP is rapidly becoming the universal protocol for AI tool integration across Anthropic Claude, Cursor, Google Antigravity, and enterprise teams. If our report dev server can speak MCP, any agent can discover and interact with the report as a native tool! Furthermore, if the report can talk to local MCP servers (like Postgres MCP or GitHub MCP), dashboard widgets can pull live corporate data without writing custom backend code."

> **Tech Lead**: "We must be crystal clear about the two directions here:
> - **Direction A (Dev Server as MCP Server)**: `serve-report.mjs` runs an MCP SSE endpoint (`/mcp/sse` and `/mcp/messages`). Any MCP client (Claude Desktop, Antigravity) connects and gets tools: `update_card(id, html)`, `read_report_state()`, `set_theme(name)`, `capture_screenshot()`. This turns our dev server into a visual display peripheral for ANY agent.
> - **Direction B (Dev Server as MCP Gateway/Client)**: The dev server reads the user's local MCP config (e.g. `~/.gemini/antigravity-cli/mcp.json` or project `.mcp.json`), and proxies tool calls initiated from the browser frontend.
> - **CRITICAL SECURITY NOTE**: Browser JavaScript cannot be allowed to call arbitrary MCP tools with local filesystem access without strict origin verification, CSRF token validation, and explicit tool allow-listing. Local loopback alone is not enough; we must enforce an ephemeral session token generated on dev server boot."

*Consensus*: Implement Direction A first (Server as MCP Server via standard SSE transport), followed by Direction B with strict CSRF protection and an explicit security allowlist.

---

### Feature 3: Modular Skill Decomposition (Matt Pocock Pattern)

> **Product Owner**: "Look at how Matt Pocock designs agent skills: hyper-focused, minimal prompt overhead, razor-sharp triggers. Currently, our `SKILL.md` is ~28KB and covers 17 CDNs, impress slides, service workers, OKLCH theme matrices, Datastar SSE, and print styles. An agent asking for a simple PDF invoice has to load all the Datastar live dashboard instructions! Can we split it into `html-report`, `html-print`, `html-dashboard`, `html-presentation`, and `html-pwa`?"

> **Tech Lead**: "The motivation is 100% correct: token efficiency and routing accuracy. A small model or focused prompt does much better when its instructions are 3KB rather than 28KB.
> **HOWEVER**, we must avoid the fatal trap of code duplication. If we fork `build-report.mjs` or `report-runtime.js` across 5 separate skill folders, we will create instant drift and maintenance hell.
> **The Architecture Solution**: **Monorepo Engine with Thin Specialized Agent Facades**.
> - The core engine (`skills/html-report/scripts/` + `assets/`) stays unified and single-source-of-truth.
> - We create thin, specialized skill definitions (`SKILL.md` files):
>   1. `html-report`: Analytical summaries, KPI scorecards, charts, data tables.
>   2. `html-print`: Pixel-perfect A4/Letter documents, invoices, `@page` stylesheets, print verification.
>   3. `html-dashboard`: Real-time hypermedia streaming, Datastar SSE, telemetry grids, agent co-pilot bridges.
>   4. `html-presentation`: Impress.js 3D slide transitions, speaker notes, keyboard deck navigation.
>   5. `html-pwa`: Service worker caching, offline PWA manifests, installable mobile app workflows."

*Consensus*: Adopt the Facade Pattern. Retain one shared engine; create 5 specialized, lightweight `SKILL.md` facades that reference the shared CLI and assets.

---

### Feature 4 & 4.1: Interactive Creation Studio & CLI "Grill-Me" Service (`/html-create` & `/html-create:cli`)

> **Product Owner**: "Calling it `/html-help` was too passive. Users don't wake up wanting 'help'; they want to **CREATE** a stunning report! Renaming this capability to **`/html-create`** and offering **`/html-create:cli`** is a massive UX leap:
> - **`/html-create`**: Serves the rich, visual browser studio with card selections, top-down constraint pruning, and the embedded live OKLCH theme studio.
> - **`/html-create:cli`**: Fires the fast, zero-friction terminal 'grill-me' interview directly in the user's shell for remote or keyboard-only workflows.
> **Crucial Product Insight**: Once Feature 4 is built, `html-create` is added directly into **Feature 3's modular skill catalog** as a first-class skill (`skills/html-create/SKILL.md`) with both slash commands (`/html-create` and `/html-create:cli`). It serves as the master onboarding orchestrator for the entire `html-*` family!"

> **Tech Lead**: "This dual-entry naming standard is exceptionally clean:
> 1. `skills/html-create/SKILL.md` becomes the 6th lightweight facade (~3.5KB).
> 2. Slash command routing:
>    - `/html-create` &rarr; launches or points to `assets/html-help.html` (or `http://localhost:3000/create`) with full interactive UI and OKLCH color matrix.
>    - `/html-create:cli` &rarr; executes `node skills/html-report/scripts/html-grill.mjs` directly in the active terminal using native Node.js `readline`.
> 3. Deterministic Handoff: Whichever mode the user chooses, the engine evaluates the domain hierarchy (`Target &rarr; Communication &rarr; App &rarr; Theme &rarr; Addons`) and outputs a deterministic prompt targeting the exact sibling skill (`@html-report`, `@html-print`, `@html-dashboard`, `@html-presentation`, or `@html-pwa`) with exact CLI flags.
> 4. Alias support: We will keep `html-help` as a gentle fallback alias pointing to `/html-create`."

*Consensus*: Standardize on `/html-create` (interactive web wizard) and `/html-create:cli` (terminal interview), and **add `html-create` directly into the Feature 3 modular skill family** as the primary creation orchestrator.

---

## 3. Scope & Phasing Summary

| Feature | Primary Artifacts | Technical Dependencies | Target Phase |
| :--- | :--- | :--- | :--- |
| **1. Bidirectional Agent Loop** | `report-runtime.js`, `serve-report.mjs`, `template-shell.html` | Datastar SSE, `agy` CLI streaming, SessionState | Phase 1 |
| **2. MCP Server Bridge** | `scripts/mcp-server.mjs`, `serve-report.mjs` | JSON-RPC 2.0, SSE Transport, CSRF Guard | Phase 2 |
| **3. Modular Skill Decomposition** | `.agents/skills/html-*`, shared core scripts | Antigravity / Agent Skill Registry | Phase 3 |
| **4. Interactive Creation Studio (`/html-create`)** | `assets/html-help.html`, `theme-compiler.mjs` | DaisyUI, Alpine.js, Showdown | Phase 4 |
| **4.1. Terminal Grill-Me Service (`/html-create:cli`)** | `scripts/html-grill.mjs` | Native Node.js `readline`, zero external npm | Phase 4 |
| **4.2. Skill Integration into Feature 3** | `.agents/skills/html-create/SKILL.md` (Slash commands `/html-create`, `/html-create:cli`) | Feature 3 registry, domain-model engine | Phase 4 (Delivers to Phase 3) |

---

*This proposal stands as the verified strategic roadmap agreed upon by the Product Owner and Tech Lead. No code implementation is being initiated in this phase.*
