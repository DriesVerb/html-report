# Tasks: Malleable Caller-Aware Skill & Tool Integration

Tasks are organized by priority (**P0 → P1 → P2**) to enable modular, step-by-step implementation.

## 1. [P0] Gitignored Vault & Directory Infrastructure
- [x] 1.1 Add `.caller-requests/` to workspace `.gitignore` and verify `git status --porcelain` ignores vault files.
- [x] 1.2 Scaffold default vault structure: `.caller-requests/profiles/` and `.caller-requests/runs/`.
- [x] 1.3 Add a sample default profile `.caller-requests/profiles/default.md` demonstrating frontmatter structure.

## 2. [P0] Profile Schema, Versioning & Auto-Scaffolding
- [x] 2.1 Create `skills/html-report/scripts/caller-registry.mjs` defining `schema_version: 1` and compatibility parser.
- [x] 2.2 Implement auto-scaffolding in `caller-registry.mjs` that automatically generates `.caller-requests/profiles/<caller-id>.md` when an unknown caller invokes the reporter.
- [x] 2.3 Implement unit tests for profile resolution, compatibility validation, and auto-scaffolding.

## 3. [P1] Ephemeral Run Management & 10-Run Pruning Lifecycle
- [x] 3.1 Implement `recordRun(callerId, payload)` in `caller-registry.mjs` to store run payloads in `.caller-requests/runs/<callerId>/<runId>/`.
- [x] 3.2 Implement automated pruning logic retaining the 10 most recent runs per caller and purging older directories.
- [x] 3.3 Verify pruning behavior with automated tests simulating 15 consecutive runs.

## 4. [P1] Precedence & Non-Destructive Override Engine
- [x] 4.1 Implement instruction merger combining Core Quality Standards, Caller Profile Rules, and Runtime Overrides.
- [x] 4.2 Enforce non-destructive guarantee: verify profile `.md` checksum remains identical before and after runs with custom overrides.

## 5. [P1] Caller CWD Output Routing & Leaf Identification
- [x] 5.1 Implement default output routing to `./report-<callerId>.html` and `./report-<callerId>.pdf` in the caller's working directory.
- [x] 5.2 Implement leaf caller extractor that normalizes chained identifiers (e.g., `teamwork/memory-leak-debugging` → `memory-leak-debugging`).

## 6. [P2] Skill Workflow & Verification Updates
- [x] 6.1 Update `skills/html-report/SKILL.md` to document the caller-aware workflow, vault layout, and CLI parameters.
- [x] 6.2 Update Playwright test suite to verify caller-profile-driven reports and default output file creation.
- [x] 6.3 Validate all OpenSpec specs and change artifacts with `openspec validate`.
