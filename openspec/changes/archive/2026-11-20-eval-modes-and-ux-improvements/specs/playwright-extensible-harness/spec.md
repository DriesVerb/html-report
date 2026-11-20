# Delta Specification: playwright-extensible-harness

## ADDED Requirements

### Requirement: Mode-Specific Layout, Transparency & Code-Block Isolation Checks
`RevealCheck` SHALL verify that `.reveal` does not paint opaque white (`rgb(255, 255, 255)`) over a non-white `.reveal-stage` and that `#presentation-notes-modal` starts hidden (`display === "none"`), `GridJsCheck` SHALL verify zero horizontal page overflow (`overflowPx <= 2`), and `runner.mjs` (`hasCode`) / `HighlightCheck` SHALL exclude `.mockup-code` terminal elements unless explicitly marked with `.hljs` or `language-*`.

#### Scenario: Presentation check catches opaque white `.reveal` stage or visible notes modal, while dashboard `.mockup-code` skips HighlightCheck
- **WHEN** `runHarness()` evaluates a dark-theme Reveal.js presentation or a Datastar dashboard containing `<div class="mockup-code"><pre><code>tick</code></pre></div>`
- **THEN** `RevealCheck` enforces stage transparency and initial notes modal hiding, `GridJsCheck` enforces `overflowPx <= 2`, and `HighlightCheck` does not fail on unhighlighted `.mockup-code` terminal output.
