# Proposal: Malleable Caller-Aware Skill & Tool Integration

## Why

External agent skills (e.g. `memory-leak-debugging`, `debug-optimize-lcp`, `troubleshooting`), subagents, and automated CI/CLI tools frequently generate analytical reports. Currently, invoking `html-report` requires either manual prompt customization or repetitive styling instructions in every single prompt, creating token waste, rule drift, and git workspace pollution. 

To make `html-report` a composable visual rendering hub, we need a **malleable, caller-aware integration architecture** that:
1. Recognizes caller identities and automatically loads their preferred report sections, theme, and styling.
2. Isolates persistent caller rulebooks and ephemeral run data inside a top-level gitignored vault (`.caller-requests/`).
3. Provides zero-configuration onboarding via automatic profile scaffolding on first invocation.
4. Maintains predictable storage with an automatic retention policy (keeping the last 10 runs per caller).
5. Supports non-destructive runtime overrides without mutating permanent caller rulebooks.
6. Emits outputs directly to the caller's working directory (`./report-<caller>.html` and `./report-<caller>.pdf`).
7. Treats multi-agent calling chains cleanly by identifying the direct leaf skill.

## What Changes

- **Top-Level Gitignored Vault (`.caller-requests/`)**:
  - Add `.caller-requests/` to `.gitignore`.
  - Structure:
    - `.caller-requests/profiles/<caller-id>.md`: Persistent reusable rulebooks formatted with YAML frontmatter.
    - `.caller-requests/runs/<caller-id>/<run-id>/`: Ephemeral run data payloads (`payload.json` / `data.csv`) and one-off overrides (`overrides.yaml`).
- **Versioned Markdown Profile Schema**:
  - Store caller profiles in Markdown with YAML frontmatter (`schema_version: 1`, `reporter_compatibility: ">=1.0.0"`, `default_theme`, `mandatory_cdns`, `custom_instructions`).
- **Automatic Profile Scaffolding (Zero-Config Onboarding)**:
  - If a caller invokes `html-report` without an existing profile, the engine auto-generates a sensible baseline profile in `.caller-requests/profiles/<caller-id>.md`.
- **Ephemeral Run Lifecycle (Retention: Last 10 Runs)**:
  - When new payloads arrive in `.caller-requests/runs/<caller-id>/`, auto-purge runs older than the 10 most recent runs for that caller.
- **Non-Destructive Runtime Overrides**:
  - Per-invocation overrides take precedence for that run only and do not alter the persistent profile.
- **Caller CWD Default Output Routing**:
  - When no output destination is passed, files are generated at `./report-<caller-id>.html` and `./report-<caller-id>.pdf` in the caller's working directory.
- **Leaf Caller Identification in Agent Chains**:
  - In nested workflows (`teamwork` → `memory-leak-debugging` → `html-report`), identify the caller as the leaf agent (`memory-leak-debugging`), ensuring modular and reusable profiles.
- **Skill Engine Integration**:
  - Extend `skills/html-report/SKILL.md` and provide helper resolution scripts in `skills/html-report/scripts/caller-registry.mjs`.

## Capabilities

### New Capabilities
- `caller-vault`: Manages the `.caller-requests/` filesystem hierarchy, gitignore exclusion, and 10-run pruning lifecycle.
- `profile-resolution`: Parses versioned Markdown frontmatter profiles, merges core quality standards with caller instructions and runtime overrides, and routes default outputs.

## Impact & Scope

- **Non-breaking**: Direct standalone user prompts continue to work with default core settings if no caller profile is specified.
- **Security & Cleanliness**: Workspace stays free of git-tracked clutter; all caller profiles and ephemeral traces remain local.
