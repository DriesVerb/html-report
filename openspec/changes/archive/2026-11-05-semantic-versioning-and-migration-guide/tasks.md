# Tasks: Semantic Versioning & Migration Assistance

> Companion Dashboard: [index.html](file:///home/eta/projects/html-report/openspec/changes/semantic-versioning-and-migration-guide/index.html) | Servable at `http://localhost:3000`  
> Direct Backlinks: [proposal.md](file:///home/eta/projects/html-report/openspec/changes/semantic-versioning-and-migration-guide/proposal.md) | [design.md](file:///home/eta/projects/html-report/openspec/changes/semantic-versioning-and-migration-guide/design.md) | [specs/semantic-versioning/spec.md](file:///home/eta/projects/html-report/openspec/changes/semantic-versioning-and-migration-guide/specs/semantic-versioning/spec.md)

## Phase 1: Package Foundation & SemVer 2.0.0 Declaration
- [x] 1.1 Create root `package.json` declaring `name: "html-report"`, `version: "1.0.0"`, ESM exports, and bin aliases
- [x] 1.2 Implement `--version` / `-v` flag in `harness.mjs` and `build-report.mjs` reading dynamic version from `package.json`
- [x] 1.3 Verify `package.json` subpath exports and module resolution via Node.js import checks
- [x] 1.4 Update `template-shell.html` and `build-report.mjs` to dynamically render SemVer version in report footer

## Phase 2: Centralized Compatibility & Deprecation Interceptor
- [x] 2.1 Implement `skills/html-report/scripts/compatibility.mjs` with deprecation catalog and warning emitter
- [x] 2.2 Wire deprecation interceptors into `build-report.mjs`, `harness.mjs`, and `serve-report.mjs`
- [x] 2.3 Add CLI compatibility audit flag (`--check-compatibility`) to scan consumer configs and scripts

## Phase 3: AI Migration Prompt Standard & Documentation Hub
- [x] 3.1 Establish `docs/semantic-versioning.md` outlining public API boundaries and SemVer policy
- [x] 3.2 Create `MIGRATION.md` and reference guide `docs/migrations/v1-to-v2.md` with turnkey `<AI_MIGRATION_PROMPT>`
- [x] 3.3 Update `README.md` with SemVer 2.0.0 badge and versioning section, and update `SKILL.md`

## Phase 4: Automated Verification & Test Suites
- [x] 4.1 Create `tests/semver.test.mjs` unit tests for `package.json` exports, version flags, and compatibility scanner
- [x] 4.2 Create `tests/semver.bdd.test.mjs` BDD tests validating scenarios in `specs/semantic-versioning/spec.md`
- [x] 4.3 Run full test suite with `node --test tests/*.test.mjs` ensuring 100% pass rate

## Phase 5: Companion Dashboard & Live Dev Server Sync
- [x] 5.1 Build companion `openspec/changes/semantic-versioning-and-migration-guide/index.html` with interactive journey stepper
- [x] 5.2 Mirror to `implementation-progress.html` and verify live dev server at `http://localhost:3000`
