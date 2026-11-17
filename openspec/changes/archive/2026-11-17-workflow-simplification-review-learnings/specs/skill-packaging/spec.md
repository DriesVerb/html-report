# Delta Specification: skill-packaging (Zero-Install Resolution & Doc Alignment)

## ADDED Requirements

### Requirement: Zero-Install Workspace Package Resolution & Supervisor Flag Forwarding
The repository SHALL keep `node_modules/@html-report/` workspace symlinks un-ignored, provide a zero-dependency ESM workspace loader (`packages/core/scripts/workspace-loader.mjs`), and preserve `process.execArgv` across all CLI shims, `server-policy.mjs`, and `supervisor.mjs`.

#### Scenario: Preview server supervisor preserves Node loader flags
- **WHEN** `serve-report.mjs` or `supervisor.mjs` spawns a child worker with active `process.execArgv` (such as `--import`)
- **THEN** the child worker inherits those loader flags alongside `--no-open` / `--port` arguments.

### Requirement: Reconciled Skill & Reference Stack Guidance
`skills/html-report/SKILL.md` (`<= 5,120` bytes) and `skills/html-report/references/architecture-and-styling.md` SHALL accurately document the Core 4 shell + 15 on-demand addons, direct `.mmd` file inclusion, verification selection semantics, gitignored `projects/`, and SSE live-reload waiting behavior.
