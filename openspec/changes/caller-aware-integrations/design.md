# Design: Malleable Caller-Aware Skill & Tool Integration

## Architecture Overview

The malleable caller integration architecture turns `html-report` into an intelligent visual rendering bus. It decouples persistent caller preferences from ephemeral execution payloads using a dedicated top-level vault directory `.caller-requests/` excluded from git.

```
html-report/ (Workspace Root)
├── .caller-requests/                     <-- Added to .gitignore
│   ├── profiles/                         <-- Persistent caller rulebooks
│   │   ├── memory-leak-debugging.md
│   │   ├── debug-optimize-lcp.md
│   │   └── default.md
│   └── runs/                             <-- Ephemeral per-run payloads (pruned: last 10)
│       └── memory-leak-debugging/
│           ├── 2026-11-02T18-00-00Z/
│           │   ├── payload.json
│           │   └── overrides.yaml
│           └── ... (max 10 runs)
├── skills/html-report/
│   ├── SKILL.md                          <-- Updated with caller awareness protocol
│   └── scripts/
│       ├── caller-registry.mjs           <-- Profile parsing, scaffolding & pruning
│       └── serve-report.mjs              <-- Live-reload server
```

## Key Components

1. **Vault Manager (`caller-registry.mjs`)**:
   - Ensures `.caller-requests/` exists and is ignored by git.
   - Provides `resolveCaller(callerId)`: finds or auto-scaffolds `.caller-requests/profiles/<callerId>.md`.
   - Provides `recordRun(callerId, payload)`: writes run data and prunes runs exceeding the 10-run limit.
   - Provides `getOutputPath(callerId, explicitPath)`: returns explicit path or defaults to `./report-<callerId>.html` in CWD.

2. **Instruction Merger Engine**:
   - Combines baseline requirements (responsive navbar, 11-CDN stack, DaisyUI themes) with profile directives and run overrides.
   - Applies the precedence hierarchy: `Runtime Overrides > Caller Profile > Core Baseline`.

3. **Leaf Identifier**:
   - Strips parent calling orchestrators to isolate the functional leaf skill (e.g. `teamwork/subagent/memory-leak-debugging` → `memory-leak-debugging`).

## Decision Log & Trade-offs

| Decision | Selected Option | Rationale |
| :--- | :--- | :--- |
| **D1: Vault Location** | Top-level `.caller-requests/` (Gitignored) | Keeps workspace git status clean; accessible across all subprojects. |
| **D2: Profile Format** | Markdown with YAML frontmatter + Versioning | Human-readable, agent-editable, and forward-compatible via `schema_version`. |
| **D3: Onboarding** | Automatic zero-config scaffolding | No setup barrier for new skills/tools invoking the reporter for the first time. |
| **D4: Run Retention** | Keep last 10 runs per caller | Hard-capped disk footprint while maintaining recent diffing/debugging history. |
| **D5: Mutation Strategy** | Non-destructive override | Run-time changes never silently corrupt permanent caller configurations. |
| **D6: Output Location** | Caller working directory (`./report-<caller>.html`) | Deliverables appear where the user or caller tool is currently working. |
| **D7: Chain Identity** | Direct leaf caller | Maximizes profile modularity and reusability across agent orchestrators. |
