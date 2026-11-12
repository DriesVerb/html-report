# Proposal: Domain-Language Code Review & Cross-Codebase Alignment

## Why
With the Ubiquitous Domain Language formalized and archived in [openspec/specs/domain-language-model/spec.md](file:///home/eta/projects/html-report/openspec/specs/domain-language-model/spec.md), the next step is to audit and align the existing codebase so that scripts, CLI flags, runtime comments, sibling skill instructions, and documentation speak the exact same language.

Specifically, we want to review and align:
1. **Core Review Areas**:
   - **Assembly vs. Pipeline Boundary** (`build-report.mjs`, `harness.mjs`): Separate raw fusion stitching (<100ms) from the orchestrating FSM state machine.
   - **Edit Mode vs. Published Document** (`template-shell.html`, `report-runtime.js`): Standardize authoring markers and verify `stripAuthoringMarkup()` cleanly produces a Published Document.
   - **User-Facing vs. Agent-Facing Distinction** (`create.html`, `html-grill.mjs`, CLI scripts): Keep human GUI workflows clean and headless agent CLI workflows strictly deterministic and machine-actionable.
   - **Two-Axis Runtime Decoupling** (`serve-report.mjs`, `datastar-sse.mjs`): Ensure Static File mode supports client-side public API fetches cleanly, while Datastar SSE hypermedia is scoped to Server-Connected mode.

2. **Additional High-Leverage Alignment Opportunities**:
   - **PWA Packaging vs. Delivery Archetype** (`pwa-builder.mjs`, `generate-pwa.mjs`, `skills/html-pwa/SKILL.md`): Clarify whether PWA is a standalone Delivery Archetype or a cross-cutting Packaging Modifier applied during Assembly to any Interactive app.
   - **Skill Router & Sibling Facades** (`skill-router.mjs`, `skills/*/SKILL.md`): Annotate each skill facade with its explicit Beneficiary, Serving Mode, and Behavioral Mode.
   - **MCP Server Tool Schemas** (`mcp-server.mjs`): Align MCP tool descriptions and JSON-RPC payloads with canonical terms (`Semantic Fragment`, `Template Shell`, `Output Deliverable`, `Published Document`).
   - **Creation Studio UI Controls** (`create.html`): Surface the **Beneficiary** (User vs. Agent) and **Two-Axis** (Serving vs. Behavioral) selectors in Create Mode.
   - **External Documentation** (`README.md`, `docs/*.md`): Harmonize `architecture-fsm.md`, `api-and-cli-reference.md`, and `live-telemetry.md` with the canonical vocabulary.

## What Changes
* **Codebase Audit & Refactoring Plan**: Non-breaking alignment of terminology, comments, CLI help text, and internal boundaries across scripts, runtime assets, and skill guides.
* **Domain Alignment Checklist**: Verifiable acceptance criteria ensuring zero deprecated synonyms in core scripts and clear separation of Assembly, Pipeline, Edit Mode, and Published Document.

## Capabilities

### New Capabilities
- `domain-code-alignment`: Verification rules and alignment standards ensuring core scripts, runtime assets, and skill documentation conform to the Ubiquitous Domain Language.

### Modified Capabilities
- `domain-language-model`: Extends practical enforcement into CLI, runtime, and skill router surfaces.

## Impact
- **Zero Breaking Changes**: Existing CLI flags and public APIs remain 100% backward-compatible (using aliases where helpful).
- **Clearer Maintenance**: Developers and AI agents reading any script immediately see which subsystem, beneficiary, and runtime axis it serves.
