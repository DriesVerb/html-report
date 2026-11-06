# Tasks: Pipeline Implementation Roadmap for Four Core Capabilities

**Status**: Shipped / Archived (All 4 Core Capabilities Implemented; 411/411 tests passing)  
**Tracking File**: `openspec/changes/pipeline-four-core-features/tasks.md`  
**Backlinks**:
- Strategic Vision: [proposal.md](file:///home/eta/projects/html-report/openspec/changes/pipeline-four-core-features/proposal.md)
- Technical Architecture: [design.md](file:///home/eta/projects/html-report/openspec/changes/pipeline-four-core-features/design.md)
- Delta Specs: [specs/](file:///home/eta/projects/html-report/openspec/changes/pipeline-four-core-features/specs/)

---

## 1. Feature 1: Bidirectional HTML &harr; Agent Interactive Loop

- [x] 1.1 Design and embed the floating/collapsible `HTMLReportAgentDock` component in `template-shell.html` with `Cmd+K` keyboard shortcut
- [x] 1.2 Implement DOM & chart element context serialization in `report-runtime.js` (`HTMLReportAgent.serializeElementContext(el)`)
- [x] 1.3 Add streaming `POST /api/agent/prompt` endpoint in `serve-report.mjs` with multi-turn session tracking (`SessionState`)
- [x] 1.4 Implement streaming token and fragment morph handler via Datastar SSE (`event: datastar-merge-fragments`)
- [x] 1.5 Add interactive confirmation cards for mutating/executable agent actions with user approval buttons

## 2. Feature 2: Two-Way Communication with MCP Server

- [x] 2.1 Implement MCP Server JSON-RPC 2.0 protocol handler in `scripts/mcp-server.mjs`
- [x] 2.2 Expose MCP SSE transport endpoints in `serve-report.mjs` (`GET /mcp/sse` and `POST /mcp/messages`)
- [x] 2.3 Expose native MCP tools to external agents: `report_get_state`, `report_update_fragment`, `report_set_theme`, `report_export_pdf`
- [x] 2.4 Implement MCP Client Gateway proxy (`POST /api/mcp/call-tool`) enabling browser widgets to invoke local MCP tools
- [x] 2.5 Implement CSRF token generator, host header validation, and `mcp_allowlist.json` security boundary

## 3. Feature 3: Modular Skill Decomposition (Matt Pocock Pattern)

- [x] 3.1 Define specialized, lightweight `<5KB` skill facades in `.agents/skills/`:
  - [x] 3.1.1 `skills/html-report/SKILL.md` (Analytical reports, charts, tables)
  - [x] 3.1.2 `skills/html-print/SKILL.md` (Paged A4/Letter PDF documents, invoices, print breaks)
  - [x] 3.1.3 `skills/html-dashboard/SKILL.md` (Real-time telemetry, Datastar SSE hypermedia, agent bridge)
  - [x] 3.1.4 `skills/html-presentation/SKILL.md` (Reveal.js slide deck presentation engine; planned for deeper expansion)
  - [x] 3.1.5 `skills/html-pwa/SKILL.md` (Offline caching, manifest, installable Progressive Web App)
  - [x] 3.1.6 `skills/html-create/SKILL.md` (Interactive onboarding studio & router, slash commands `/html-create` & `/html-create:cli`)
- [x] 3.2 Verify all facades share the unified `scripts/` and `assets/` core engine without code duplication
- [x] 3.3 Add skill router integration tests verifying agent intent matching and token reduction benchmarks

## 4. Feature 4 & 4.1: Interactive Creation Studio (`/html-create`) & Terminal Grill Service (`/html-create:cli`)

- [x] 4.1 Implement domain model schema and deterministic prompt generator (`scripts/domain-model.mjs`)
- [x] 4.2 Build standalone interactive decision wizard HTML page (`assets/html-help.html` / `create.html`)
  - [x] 4.2.1 Implement top-down questionnaire (Target &rarr; Communication &rarr; App &rarr; Addons)
  - [x] 4.2.2 Embed live DaisyUI OKLCH Theme Creator Studio with real-time swatch preview and color scheme picker
  - [x] 4.2.3 Implement deterministic prompt output box with 1-click clipboard copy
- [x] 4.3 Implement CLI counterpart `scripts/html-grill.mjs` with zero-dependency Node.js readline terminal interview for `/html-create:cli`
- [x] 4.4 Integrate `skills/html-create/SKILL.md` into Feature 3's skill catalog with `/html-create` and `/html-create:cli` slash command triggers
- [x] 4.5 Add test suite validating deterministic prompt output matching exact builder flags across all permutations
- [x] 4.6 Design Studio Refinements & User Feedback Enhancements:
  - [x] 4.6.1 Constraint pruning: Eliminate offline-first and installable app options when Deliverable Target is Print
  - [x] 4.6.2 Fix theme picker dropdown direction to expand to the right without clipping
  - [x] 4.6.3 Custom Brand Theme Studio with synchronized text inputs + color pickers, naming ("user" default, editable), single managed custom theme in dropdown
  - [x] 4.6.4 Normalize Markdown Document Reader card grid width to single column matching other components
  - [x] 4.6.5 Remove Deterministic CLI command accordion and focus studio purely on AI Prompt
  - [x] 4.6.6 AI Prompt enhancements: Rename to "AI Prompt", specify `/<skill>` command, and incorporate optional board goals and audience inputs
  - [x] 4.6.7 Reference Documents, Data-Sets & Images in Creation Studio: File picker, popular file presets, collected files list with Lucide icons, "+ Note" context annotation, and real-time AI prompt scaffolding integration
