# Delta Specification: Interactive html-create Studio & CLI "Grill-Me" Service

**Capability**: `html-create-wizard-domain-model`  
**Parent Change**: `pipeline-four-core-features`  
**Stage**: `Planning`  
**Slash Commands**: `/html-create` (Web Studio) & `/html-create:cli` (Terminal Grill)  
**Skill Target**: Merged into `skills/html-create/` as part of Feature 3 suite  

---

## 1. Requirement & User Stories (UX/UI/PO Refined)

### User Story 4.1: Human-Centered Deliverable Decision Flow (/html-create)
As a user (executive, product manager, or engineer) unsure how to configure my report, I want to invoke `/html-create` to get an intuitive top-down wizard framed around my actual goals (Deliverable Purpose &rarr; Operational Data Mode &rarr; Content Features &amp; AI &rarr; App Download Options &rarr; Startup Theme &amp; Branding) without developer plumbing jargon so that dependent options are automatically resolved.

### User Story 4.2: Operational Mode vs Capability Feature Separation
As a user, I want a crystal-clear distinction between:
- **Operational Data Mode (Step 2)**:
  - `Static Standalone`: Zero server needed. Single self-contained HTML file.
  - `Live Connected`: Server-backed stream (`SSE`) on `localhost:3000`.
- **Intelligence & Enterprise Features (Step 3 - Section B)**:
  - `Interactive AI Assistant`: In-browser Cmd+K floating prompt dock with Datastar morphing. *Only available in Live Connected Mode.*
  - `Enterprise Tools & DBs (MCP)`: Widget proxy to databases and MCP servers. *Only available in Live Connected Mode.*
- **App Download Packaging (Step 4)**:
  - `Browser Page`: Standard web page in browser tabs.
  - `Downloadable App (Live Connected Window)`: PWA pinned to dock/home screen for real-time telemetry cockpits.
  - `Downloadable Offline-First App`: PWA with full Service Worker caching (`sw.js`) that works 100% offline without internet.

### User Story 4.3: Navbar-Matching Theme Picker & Prompt-First Hierarchy
As a user configuring aesthetics, I want the wizard to provide the exact same DaisyUI 32-theme dropdown as the report navbar, setting which theme loads by default on startup.
As a user generating an AI prompt, I want the Deterministic AI Agent Prompt front-and-center in the right column, with the Live Wireframe Mockup and CLI Command housed in neat expandable accordions so they never push down or obscure the prompt.

### User Story 4.4: 100% Static Zero-Node Operation
As a user without Node.js installed or working offline, I want the creation wizard to operate 100% client-side in any browser via `file:///` or static hosting, including 1-click in-browser client-side generation of starter `.html` bundles via `Blob` APIs.

### User Story 4.4: Real-Time Live Wireframe Preview
As a user selecting options in the wizard, I want to see a live responsive wireframe mockup on the right side that dynamically reflects my choices in real-time (toggling mini charts, tables, diagrams, live stream indicators, app install buttons, and theme swatches) before generating the final prompt.

### User Story 4.5: Deterministic Prompt & Command Synthesis
As a user completing the wizard, I want a 1-click deterministic prompt and terminal command generated, perfectly matching the agent's architectural standards, with zero ambiguity or guesswork, automatically routing into the appropriate specialized skill (`@html-report`, `@html-print`, `@html-dashboard`, `@html-presentation`).

### User Story 4.6: Terminal CLI Counterpart (/html-create:cli)
As a terminal-bound developer in a remote shell, I want to run `/html-create:cli` (or `node skills/html-report/scripts/html-grill.mjs`) to complete the same guided interview with arrow keys and have the deterministic prompt copied to my clipboard.

---

## 2. Technical Contracts

### 2.1 Domain Configuration Schema
```typescript
interface ReportDomainConfig {
  title: string;
  target: "executive-report" | "printable-doc" | "live-dashboard" | "slide-presentation";
  operationalMode: "static" | "live"; // Core transport layer
  appPackaging: "browser" | "live-app" | "offline-app"; // Window PWA vs Offline Cache PWA
  defaultStartupTheme: string; // DaisyUI 32-theme identifier (default: "light")
  customBrandColorHex?: string | null; // Optional primary hex with auto-harmonized contrast math
  features: {
    // Visual & Data Components (Available in both static & live modes)
    addons: Array<
      | "charts"        // Chart.js (v4.4)
      | "mermaid"       // Mermaid (v11.4)
      | "gridjs"        // Grid.js (v6.2)
      | "leaflet"       // Leaflet (v1.9)
      | "katex"         // KaTeX (v0.16)
      | "fullcalendar"  // FullCalendar (v6.1)
      | "showdown"      // Showdown (v2.1)
      | "highlightjs"   // Highlight.js (v11.9)
    >;
    // Intelligence & Enterprise Connectivity (Strictly gated by operationalMode === "live")
    hasAiAgentBridge: boolean;     // In-browser floating Cmd+K dock with live fragment morphing
    hasEnterpriseMcpTools: boolean; // Widget proxy to PostgreSQL / GitLab MCP servers
  };
}
```

---

## 3. Acceptance Criteria

- [ ] Interactive wizard HTML page operates 100% client-side with zero external server dependencies.
- [ ] Changing Target Format automatically adjusts compatible Communication Models (e.g., Printable PDF disables live SSE and AI prompt dock).
- [ ] Selecting "Downloadable as an App" enables `--pwa` flag and dynamically displays the "📲 Install App" badge in the live wireframe preview.
- [ ] Theme selection defaults to standard 32 themes without blocking the user with mandatory color pickers; custom brand color pickers are accessible via progressive disclosure.
- [ ] Live wireframe preview dynamically toggles corresponding mockup elements (charts, diagrams, tables, maps, calendar) in real-time as checkboxes are toggled.
- [ ] Deterministic prompt output generates exact CLI command matching builder standards with zero token waste.
- [ ] CLI script runs in standard Node.js without third-party npm packages.
