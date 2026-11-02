# Design: Deterministic State Machine Harness & Remediation Orchestrator

## Context
See [proposal.md](./proposal.md) for problem context and motivation.
`skills/html-report/` features modular scripts:
- `build-report.mjs` (assembly and CDN injection)
- `verify-report.mjs` (Playwright responsive and visual check)
- `caller-registry.mjs` (profile resolution and run directory pruning)

While these tools are deterministic individually, smaller and less capable models (e.g. Flash-Lite, local open-weight models, or constrained agent workers) struggle to coordinate multi-step workflows. They hallucinate CLI flags, skip verification, fail to parse raw Playwright stdout, and get caught in unbounded hallucination loops when CSS overflows occur.

## Goals / Non-Goals

**Goals:**
- **Zero-Dep & Zero Package Manager**: Pure native Node.js standard library (`node:fs`, `node:path`, `node:child_process`). Runs instantly on any system with Node 18+ without `npm install` or `pnpm`.
- **Agnostic & Small-Model First**: Designed for less capable models—single-command execution (`run`), bounded retries, and spoon-fed prescriptive JSON error payloads.
- **Deterministic Auto-Fix Layer (`--auto-fix`)**: Automatically cures trivial mechanical defects (stripping `<html>`/`<body>` boilerplate, generating slugified `id`s for headings missing them) so smaller models never get penalized for minor mechanical oversights.
- **Prescriptive Error Payloads (Error-as-Instruction)**: Outputs structured JSON containing exact line numbers, DOM selectors, and literal code snippets telling the model exactly what to change.
- **Sub-2ms Cold Start Speed**: Zero startup overhead preserving agent tool-call latency.

**Non-Goals:**
- Adding `xstate` or any npm runtime dependencies to `scripts/`. (A zero-dependency FSM pattern achieves full mathematical determinism without package manager baggage).
- Modifying client-side runtime behavior inside `report-runtime.js` or `template-shell.html`.

## Architectural Architecture

```mermaid
flowchart TD
    Start([Single CLI Command: harness.mjs run]) --> S_Idle[State: IDLE]
    S_Idle -->|READ_FRAGMENT| S_Validating[State: VALIDATING]
    
    S_Validating -->|Auto-Fixable Flaws (Missing IDs, Outer Tags)| S_AutoFix[State: AUTO_FIXING]
    S_AutoFix --> S_Validating
    
    S_Validating -->|Fatal Syntax Error| S_Remediating[State: REMEDIATING]
    S_Validating -->|Valid Fragment| S_Assembling[State: ASSEMBLING]
    
    S_Assembling -->|Assembly Error| S_Remediating
    S_Assembling -->|Assembly Success| S_Verifying[State: VERIFYING]
    
    S_Verifying -->|Playwright Error / Overflow| S_Remediating
    S_Verifying -->|Verification Passed (0 Errors)| S_Completed[State: COMPLETED]
    
    S_Remediating -->|Retry Count < 3| S_OutputDirective[Output Spoon-Fed Error JSON]
    S_Remediating -->|Retry Count >= 3| S_Failed[State: FAILED (Exit 1)]
    
    S_Completed --> EndSuccess([Exit 0 & Final Report Ready])
    S_OutputDirective --> AgentFix([Agent Applies Exact Patch])
    AgentFix --> Start
```

## Decisions

### 1. Zero-Dependency Native Node FSM Engine
- **Decision**: Avoid all package managers and external npm dependencies. Implement the state machine runner entirely using native Node.js ES modules.
- **Rationale**: Eliminates `package.json`, `pnpm install`, and dependency version mismatches. Ensures 100% platform and agent agnosticism (works on Claude Code, Gemini CLI, Cursor, Antigravity, local Llama runners) with <2ms execution startup.

### 2. "Small Model First" Spoon-Fed Error-as-Instruction Protocol
- **Decision**: When validation or verification fails, emit an explicit `instruction_for_agent` field in the JSON payload:
```json
{
  "status": "REMEDIATION_REQUIRED",
  "attempt": 1,
  "maxAttempts": 3,
  "failureType": "HORIZONTAL_OVERFLOW",
  "culprit": {
    "selector": "#performance-matrix",
    "viewport": "640px (sm)",
    "scrollWidth": 780,
    "clientWidth": 526
  },
  "instruction_for_agent": "In your fragment file, find '#performance-matrix'. Wrap this element in <div class=\"overflow-x-auto w-full\"> or change the grid to single-column on mobile with 'grid-cols-1 md:grid-cols-2'. Then re-run the harness command."
}
```
- **Rationale**: Smaller models cannot interpret headless browser stack traces. Spoon-feeding the exact remediation directive enables smaller models to succeed on the second attempt with zero hallucination.

### 3. Deterministic Pre-Flight Auto-Fix Engine
- **Decision**: Automatically fix trivial formatting issues before compiling:
  - Strip outer `<!DOCTYPE html>`, `<html>`, `<head>`, `<body>`, and `<main>` tags if the agent accidentally wrapped them.
  - Slugify and inject unique `id` attributes into `h1`, `h2`, `h3` tags that lack them.
  - Automatically wrap bare `<table>` elements lacking responsive wrappers if `--auto-fix` is enabled (default: true).
- **Rationale**: Prevents failing the pipeline on mechanical issues that deterministic regex/AST transforms can solve in 0.5ms.

## Risks / Trade-offs

- **[Risk] Auto-fix might alter intentional markup**  
  $\to$ *Mitigation*: Auto-fixes are logged verbosely to stdout and restricted to non-destructive structural corrections (adding IDs, stripping outer wrapper tags).
- **[Risk] Smaller models ignore the JSON output**  
  $\to$ *Mitigation*: The harness outputs a high-contrast terminal banner above the JSON with a human-and-agent readable single-line fix instruction.
