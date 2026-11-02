# Architecture Reference: Deterministic FSM Harness & Remediation Orchestrator

## Overview

The HTML Report Harness (`skills/html-report/scripts/harness.mjs`) is a **zero-dependency, pure Node.js finite state machine (FSM)** and remediation supervisor. It provides an agnostic, highly resilient single command for compiling and validating publication-grade HTML reports across diverse model tiers (from frontier models to local, small, or constrained agent workers).

---

## 1. Zero-Dependency & Pure Node.js Standard Library

The harness runs exclusively on native Node.js built-ins (`node:fs`, `node:path`, `node:process`, `node:child_process`, `node:url`):
- **No Package Manager Dependency**: Executes cleanly on Node 18+ without requiring `npm install` or `pnpm`.
- **Sub-2ms Cold Start**: Instant initialization prevents tool-call latency bottlenecks in autonomous agent loops.
- **Universal Portability**: Identical behavior across all operating systems, agent runners, and CLI environments.

---

## 2. Finite State Machine (FSM) Lifecycle

The lifecycle follows strict, mathematically deterministic transitions:

```mermaid
flowchart TD
    S_Idle([State: IDLE]) -->|READ_FRAGMENT| S_Validating[State: VALIDATING]
    
    S_Validating -->|Auto-Fixable Flaws (Missing IDs, Outer Wrappers)| S_AutoFix[State: AUTO_FIXING]
    S_AutoFix --> S_Validating
    
    S_Validating -->|Fatal Syntax Error & Retries < 3| S_Remediating[State: REMEDIATING]
    S_Validating -->|Valid Fragment| S_Assembling[State: ASSEMBLING]
    
    S_Assembling -->|Assembly Error & Retries < 3| S_Remediating
    S_Assembling -->|Assembly Success| S_Verifying[State: VERIFYING]
    
    S_Verifying -->|Verification Error & Retries < 3| S_Remediating
    S_Verifying -->|Verification Passed| S_Completed[State: COMPLETED]
    
    S_Remediating -->|Attempt >= 3| S_Failed[State: FAILED (Exit 1)]
    S_Remediating -->|Output Prescriptive Instruction| AgentFix([Agent Applies Exact Patch])
    AgentFix --> S_Idle
```

### State Definitions

| State | Purpose | Next States |
| :--- | :--- | :--- |
| `IDLE` | Initial state awaiting input fragment resolution | `VALIDATING`, `FAILED` |
| `VALIDATING` | Pre-flight AST/semantic scan for missing IDs, outer boilerplate, and bare tables | `AUTO_FIXING`, `ASSEMBLING`, `REMEDIATING`, `FAILED` |
| `AUTO_FIXING` | Mechanical non-destructive transforms applied to fragment | `VALIDATING` |
| `ASSEMBLING` | Invokes deterministic report builder to compile standalone HTML | `VERIFYING`, `REMEDIATING`, `FAILED` |
| `VERIFYING` | Executes Playwright responsive and console verification (`--quick`) | `COMPLETED`, `REMEDIATING`, `FAILED` |
| `REMEDIATING` | Emits spoon-fed JSON instruction directive and high-contrast banner | `IDLE`, `FAILED` |
| `COMPLETED` | Terminal success state: final verified report ready | *Terminal (Exit 0)* |
| `FAILED` | Terminal failure state: retry threshold exceeded or unrecoverable error | *Terminal (Exit 1)* |

---

## 3. Pre-Flight Linter & Mechanical Auto-Fixes

Smaller models often make minor mechanical formatting mistakes when writing HTML fragments. Rather than failing the pipeline, the harness automatically cures them:

1. **Outer Boilerplate Stripping**:
   - Strips accidental `<!DOCTYPE html>`, `<html>`, `<head>`, `<body>`, and `<main>` tags while preserving inner semantic markup.
   - Cleans leading YAML frontmatter headers if present.
2. **Missing Heading ID Synthesis**:
   - Injects unique, slugified `id="..."` attributes into `<h1>`, `<h2>`, and `<h3>` tags lacking them.
   - Preserves existing heading attributes and guarantees zero duplicate IDs across the document.
3. **Bare Table Wrapping**:
   - Automatically wraps unadorned `<table>` tags in `<div class="overflow-x-auto w-full">` to prevent mobile viewport blowouts.

---

## 4. "Small-Model First" Prescriptive Remediation Protocol

When validation or browser verification fails, smaller models get lost reading complex terminal stack traces. The harness intercepts failures and generates a spoon-fed `instruction_for_agent` error payload:

```json
{
  "status": "REMEDIATION_REQUIRED",
  "attempt": 1,
  "maxAttempts": 3,
  "failureType": "HORIZONTAL_OVERFLOW",
  "culprit": {
    "selector": "#performance-matrix",
    "tag": "div",
    "id": "performance-matrix",
    "viewport": "640px (sm)",
    "scrollWidth": 780,
    "clientWidth": 526
  },
  "instruction_for_agent": "In your fragment file, find '#performance-matrix'. Wrap this element in <div class=\"overflow-x-auto w-full\"> or change the grid to single-column on mobile with 'grid-cols-1 md:grid-cols-2'. Then re-run the harness command."
}
```

### High-Contrast Terminal Banner

In human/agent interactive logs, a high-contrast ASCII banner is printed immediately above the JSON:

```
================================================================================
⚠ REMEDIATION DIRECTIVE FOR AGENT (Attempt 1 of 3)
--------------------------------------------------------------------------------
DIRECTIVE: In your fragment file, find '#performance-matrix'. Wrap this element in <div class="overflow-x-auto w-full">...
CULPRIT SELECTOR: #performance-matrix (640px (sm))
================================================================================
```

---

## 5. Bounded Retry Supervisor

To prevent agents from entering infinite retry loops when facing unsolvable constraints, the harness supervises retry attempts:
- Default threshold: `maxAttempts = 3`.
- Can be customized via `--attempt <n>` and `--max-attempts <n>`.
- Upon reaching attempt 3, the harness transitions to `FAILED`, outputs `status: "FAILED"`, and exits 1.

---

## 6. CLI Command Reference

```bash
# Unified Single Command (Recommended for all agents)
node skills/html-report/scripts/harness.mjs run fragment.html [options]

# Useful flags:
#   --output, -o <file>       Output file destination (default: ./report.html)
#   --title, -t <title>       Report title (default: "HTML Report")
#   --printable, -p           Enable printable styles (@media print)
#   --no-auto-fix             Disable mechanical auto-fix transforms
#   --no-verify               Skip Playwright verification
#   --full-verify             Verify across all 5 responsive breakpoints
#   --attempt <n>             Current attempt counter (default: 1)
#   --max-attempts <n>        Maximum allowed retries (default: 3)
#   --caller <id>             Caller identifier for caller registry profiles
#   --pdf <file.pdf>          Generate target PDF during verification
#   --json                    Output machine-readable JSON diagnostics
```
