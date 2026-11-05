# Design: Semantic Versioning Architecture & AI Migration Assistant

> Companion Dashboard: [index.html](file:///home/eta/projects/html-report/openspec/changes/semantic-versioning-and-migration-guide/index.html) | Servable at `http://localhost:3000`  
> Direct Backlinks: [proposal.md](file:///home/eta/projects/html-report/openspec/changes/semantic-versioning-and-migration-guide/proposal.md) | [tasks.md](file:///home/eta/projects/html-report/openspec/changes/semantic-versioning-and-migration-guide/tasks.md) | [specs/semantic-versioning/spec.md](file:///home/eta/projects/html-report/openspec/changes/semantic-versioning-and-migration-guide/specs/semantic-versioning/spec.md)

## Context

`html-report` is an LLM-agnostic agent skill and deterministic report compilation harness. As developers integrate `html-report` into downstream repositories, custom CLI toolchains, and multi-agent systems, the library requires formal packaging, SemVer stability guarantees, and an automated breaking change migration workflow.

Currently, the repository lacks a root `package.json`. While CLI scripts (`harness.mjs`, `build-report.mjs`, `serve-report.mjs`, `generate-pwa.mjs`) work reliably via direct file execution, consumers importing the library need standard Node.js package resolution, version querying, and deprecation protection.

## Goals / Non-Goals

### Goals
- **Root Package Standard (`package.json`)**: Provide a standard ESM package configuration with declared version `1.0.0`, subpath exports, bin aliases, and engine requirements.
- **Formal Public API Contract & SemVer 2.0.0 Policy**: Clearly demarcate public vs internal interfaces across CLI flags, programmatic JS exports, template shell token contracts, Datastar SSE events, and `SKILL.md` triggers.
- **Runtime Deprecation & Breaking Change Interceptor**: Provide a centralized compatibility utility (`skills/html-report/scripts/compatibility.mjs`) that inspects CLI arguments and API options, warns of deprecated aliases, suggests replacements, and prevents silent regressions.
- **AI-Ready Migration Prompt Standard**: Standardize turnkey, copy-paste AI prompt templates within versioned migration guides (`docs/migrations/`) so developers can instruct any coding agent (Antigravity, Claude Code, Cursor, Codex) to mechanically migrate their downstream code.
- **Automated Verification**: Build unit and native BDD tests validating SemVer export resolution, CLI version flags, deprecation banners, and migration prompt integrity.

### Non-Goals
- Publishing to the public npm registry during this change (package will be 100% npm-ready, but actual npm token publishing remains in maintainer control).
- Changing existing stable CLI flags (v1.0.0 guarantees 100% backward compatibility with all existing flags and workflows).

## Technical Decisions

### Decision 1: Root `package.json` with Subpath ESM Exports

To support both command-line execution and programmatic library consumption, the root `package.json` will declare:

```json
{
  "name": "html-report",
  "version": "1.0.0",
  "type": "module",
  "bin": {
    "html-report": "./skills/html-report/scripts/harness.mjs",
    "html-report-build": "./skills/html-report/scripts/build-report.mjs",
    "html-report-serve": "./skills/html-report/scripts/serve-report.mjs",
    "html-report-pwa": "./skills/html-report/scripts/generate-pwa.mjs"
  },
  "exports": {
    ".": "./skills/html-report/scripts/harness.mjs",
    "./build": "./skills/html-report/scripts/build-report.mjs",
    "./serve": "./skills/html-report/scripts/serve-report.mjs",
    "./pwa": "./skills/html-report/scripts/pwa-builder.mjs",
    "./theme": "./skills/html-report/scripts/theme-compiler.mjs",
    "./compatibility": "./skills/html-report/scripts/compatibility.mjs",
    "./package.json": "./package.json"
  }
}
```

*Rationale*: Enables downstream libraries to write clean imports such as `import { buildReport } from 'html-report/build'` or execute `npx html-report` without needing deep directory paths.

### Decision 2: Centralized Compatibility Interceptor (`compatibility.mjs`)

Create a lightweight, zero-dependency helper (`skills/html-report/scripts/compatibility.mjs`) containing:
- Catalog of deprecated flags, renamed parameters, and breaking deltas across versions.
- `checkDeprecatedFlags(args, context)`: Intercepts CLI arguments, logs structured migration warnings to stderr, and maps legacy flags to canonical replacements.
- `checkCompatibility(projectDir)`: Scans consumer scripts, configs, and fragments to identify breaking changes or deprecated usages.

```mermaid
flowchart TD
    Consumer["Downstream Consumer / CLI Call"] --> Interceptor["compatibility.mjs Interceptor"]
    Interceptor -->|Valid Flag / API| Harness["Standard Pipeline Execution"]
    Interceptor -->|Deprecated Flag Detected| Warning["Emit Deprecation Banner with Migration Link"]
    Warning --> Harness
    Interceptor -->|Breaking / Retired Flag (Major Bump)| Error["Throw Structured Remediation Error with AI Migration Prompt"]
```

### Decision 3: AI Migration Prompt Standard (`<AI_MIGRATION_PROMPT>`)

Breaking change documentation in `docs/migrations/` and `MIGRATION.md` will follow a structured dual format:
1. **Human Technical Walkthrough**: Before/after code snippets, rationale, and behavioral deltas.
2. **AI Agent Migration Prompt**: A fenced block with precise instructions, file search patterns, regex transforms, and verification commands designed to be pasted directly into an AI coding agent:

```markdown
````text
<AI_MIGRATION_PROMPT>
You are an expert AI refactoring engineer upgrading this project's `html-report` integration from v1.x to v2.x.
Follow these exact instructions:
1. Scan all project files for references to deprecated flags: [old-flag] -> [new-flag].
2. Update imports: replace [old-import] with [new-import].
3. Run `npm test` or `node --test` to verify all reports compile without warnings.
</AI_MIGRATION_PROMPT>
````
```

## Risks / Trade-offs

- **[Risk] Adding root package.json could conflict with global or agent symlinks**  
  → *Mitigation*: The skill canonical path remains `skills/html-report/` and `.agents/skills/html-report` continues to symlink to it. The root `package.json` points directly into `skills/html-report/scripts/`.
- **[Risk] Deprecation warnings might clutter automated agent outputs**  
  → *Mitigation*: Warnings are routed cleanly to stderr with a distinct `[html-report deprecation]` prefix and only emitted when deprecated options are actively used.

## Migration Plan

1. Release `1.0.0` as the baseline SemVer release establishing the public API contract.
2. Provide `docs/semantic-versioning.md` detailing the versioning policy, stability guarantees, and public API boundary.
3. Establish `MIGRATION.md` and `docs/migrations/` ready for future releases.
