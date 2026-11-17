# Tasks: Rename `/html-create` to `/html-studio`

## Phase 1: Skill & Discovery Migration
- [x] Rename `skills/html-create/` to `skills/html-studio/` and update `SKILL.md` frontmatter/docs (keeping `/html-create` alias in description)
- [x] Replace `.agents/skills/html-create` symlink with `.agents/skills/html-studio -> ../../skills/html-studio`
- [x] Update cross-references in sibling `SKILL.md` files (`html-report`, `html-dashboard`, `html-presentation`, `html-print`, `html-pwa`)

## Phase 2: Router, Server Routes & Domain Model
- [x] Update `skills/html-report/scripts/skill-router.mjs` to canonical `'html-studio'` while keeping `/html-create` triggers
- [x] Add `/studio` and `/html-studio` routes + manifest referer matching in `packages/studio/scripts/routes/static.mjs` (preserving `/create` & `/html-create`)
- [x] Update `packages/studio/scripts/lib/domain/studio-config.mjs`, `domain-model.mjs`, `html-grill.mjs`, and `open-create.{mjs,sh}` copy/output

## Phase 3: Documentation & Tests
- [x] Update `AGENTS.md`, `docs/codebase-map.md`, and `TODO.md` references
- [x] Update unit, BDD, integration, and E2E tests (`modular-skills.test.mjs`, `domain-model.test.mjs`, `domain-language.bdd.test.mjs`, `scaffold-agent.test.mjs`, `html-create.bdd.test.mjs`, `experience-review-remediations.test.mjs`, `html-create.e2e.test.mjs`)

## Phase 4: Verification
- [x] Run `npm test` (`test:unit`) and `npm run test:e2e` and verify all tests pass
