# Delta Specification: fragment-only-skill-references

## ADDED Requirements

### Requirement: Fragment-Focused Skill Architecture Reference (`<= 150` Lines)
`skills/html-report/references/architecture-and-styling.md` SHALL document only Semantic Fragment (`<main id="report-main">`) authoring rules, addon auto-detection triggers, rendering modes, and copy-pasteable `<main>` component recipes within `<= 150` lines, omitting raw HTML dumps of `template-shell.html`'s `<head>`, `<header class="navbar">`, and `<footer>`.

#### Scenario: Agent reads architecture reference without ingesting shell HTML boilerplate
- **WHEN** an agent reads `skills/html-report/references/architecture-and-styling.md`
- **THEN** the file is `<= 150` lines and contains actionable `<main>` patterns and addon triggers without raw `<header>` navbar or `<head>` script blocks that could induce duplicate-shell hallucinations.
