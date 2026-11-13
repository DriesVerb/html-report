# skill-packaging Delta Specification

## ADDED Requirements

### Requirement: Ephemeral `projects/` Output Workspace (`.gitignore` & Git Hygiene)
The repository SHALL ignore the `projects/` directory in `.gitignore` and SHALL NOT track generated user or test reports under `projects/` in git version control history.

#### Scenario: Generated reports in `projects/` are ignored by git
- **WHEN** `scaffold-project.mjs --project sample-report` creates `projects/sample-report/index.html`
- **THEN** `git status --porcelain projects/` reports zero untracked or modified files and `git ls-files projects/` is empty.

### Requirement: Dedicated Default Ports (`3031` / `3032`) & Pre-Authoring Environment Preflight CLI
The skill SHALL default project servers and the Turnkey AI Bridge to port `3031` (with `3032` as secondary/fallback port rather than `3000`), and SHALL provide `skills/html-report/scripts/preflight.mjs` to check canonical skill path resolution, port availability (`3031`/`3032`), Playwright or system Chrome availability, and available AI inference providers before authoring begins.

#### Scenario: Running environment preflight CLI
- **WHEN** `node skills/html-report/scripts/preflight.mjs --json` is executed
- **THEN** it outputs a structured JSON diagnostic containing `skillRoot`, `ports` (`3031`, `3032`, and `recommendedPort`), `browser` (`playwrightChromium`, `systemChrome`, `ready`), and `ai` (`providerAvailable`, `activeProvider`, `checkedProviders`).

### Requirement: Vertical-Slice Authoring Workflow Documentation
`skills/html-report/SKILL.md` and `skills/html-report/references/agent-authoring-guide.md` SHALL document the 7-step vertical-slice authoring workflow (Preflight, Feature Contract, Minimal Vertical Slice, Content Expansion, Readiness-Based Browser Checks, HTTP vs `file://` Verification, and Isolated Test State), explicit Datastar `@get`/`@post` syntax, and responsive `<canvas>` `min-w-0` grid constraints.

#### Scenario: Agent reads authoring workflow guidance
- **WHEN** an agent inspects `skills/html-report/SKILL.md` and `skills/html-report/references/agent-authoring-guide.md`
- **THEN** both documents specify the vertical-slice verification step before full content expansion and warn against `$get` Datastar syntax and unconstrained flex/grid `<canvas>` containers.
