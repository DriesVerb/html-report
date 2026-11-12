# Proposal: Ubiquitous Domain Language Unification & Feature Alignment Framework

## Why
As the `html-report` repository has evolved into a full ecosystem supporting both AI coding agents and human developers, we need a common, unambiguous vocabulary grounded in how people and agents actually interact with the software.

To eliminate confusion when proposing, designing, or aligning on features, this proposal codifies:
1. **Feature Beneficiary**: Every feature must explicitly state whether it is **User-Facing** (e.g. Creation Studio GUI, visual theme pickers, Quill rich editor, printable layouts) or **Agent-Facing** (e.g. headless CLI flags, token-saving semantic `<main>` fragments, mechanical auto-repairs, JSON schemas, Turnkey reconnect prompts).
2. **Assembly vs. Pipeline**:
   - **Assembly**: The fast (<100ms), reliable mechanical join putting the Semantic Fragment, Template Shell, and assets together.
   - **Pipeline**: The state machine orchestrator around assembly (pre-flight normalizers, addon detection, caching, and post-processing).
3. **Serving Mode vs. Behavioral Mode (The Two Axes)**:
   - **Serving Mode**: *Static File* (`file:///`, static hosting, zero backend server) vs. *Server-Connected* (backed by dev server on port 3000 with SSE and agent actions).
   - **Behavioral Mode**: *Passive / Printable* (fixed document, PDF export, `@page`) vs. *Interactive / Reactive* (client-side API fetches like PokéAPI/Weather, filters, or live SSE streams).
4. **Delivery Archetypes**: Goal-driven destinations (`@html-report`, `@html-dashboard`, `@html-presentation`, `@html-print`, `@html-pwa`) that know what they need to become.
5. **Document Lifecycle**: **Create Mode** (guided intent) &rarr; **Edit Mode** (in-flight draft adjustments) &rarr; **Published Document** (final end-product with authoring chrome cleanly pruned).
6. **OpenSpec Journey**: Strictly preserved as the spec-driven development and governance protocol (`proposal.md`, `design.md`, `tasks.md`, `specs/`) with living progress mirrored to `http://localhost:3000`.

## What Changes
* **Subsystem & Feature Metamodel**:
  - Adds `beneficiary: 'user' | 'agent' | 'hybrid'` to feature specifications.
  - Replaces the single static/live flag with the orthogonal **Serving Mode** and **Behavioral Mode** axes.
  - Codifies the boundary between mechanical **Assembly** and orchestrating **Pipeline**.
* **Interactive Domain Architecture Report & Alignment Workbench**:
  - Live on `http://localhost:3000` via [implementation-progress.html](file:///home/eta/projects/html-report/implementation-progress.html).
  - Displays the 2x2 Serving vs. Behavioral matrix and User-Facing vs. Agent-Facing feature filters.
  - Interactive Feature Alignment Workbench allowing developers and agents to select beneficiary, serving mode, behavioral mode, and core subsystem to generate standardized OpenSpec feature prompts.

## Capabilities

### New Capabilities
- `domain-ubiquitous-language`: Formal specification and canonical glossary of all domain entities across Assembly, Pipeline, Delivery Archetypes, Create Mode, Edit Mode, and Published Documents.
- `feature-alignment-framework`: 5-step feature alignment rubric enforcing beneficiary declaration, 2-axis mode distinction, and OpenSpec compliance.
- `domain-language-dashboard`: Publication-grade interactive companion report serving on `http://localhost:3000`.

### Modified Capabilities
*(None - existing runtime harnesses, scripts, and skills remain 100% backward-compatible)*

## Impact
- **Agent vs. Human Alignment**: Prevents building complex CLI tools under the guise of human features, and prevents adding GUI overhead to headless agent workflows.
- **Serving Clarity**: Removes the misconception that static files cannot be interactive or fetch external public APIs.
- **Fast Onboarding**: Gives any developer or AI coding agent an instant map of where a feature belongs.
