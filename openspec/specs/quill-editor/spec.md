# quill-editor Specification

## Purpose
Provides interactive in-browser rich text WYSIWYG editing, dual-mode simple and complex board goal authoring within the Creation Studio wizard, content synchronization, local persistence, and deterministic prompt synthesis.

## Requirements

### Requirement: Creation Studio Section A Component Selection
The Creation Studio wizard MUST include Quill WYSIWYG Editor as a selectable visual component under Section A (Visual & Data Components).

#### Scenario: User toggles Quill component checkbox
- **WHEN** user selects `#chk-quill` in Section A of `create.html`
- **THEN** the wizard updates the simulated wireframe mockup showing the Quill editor widget and appends Quill to the selected capabilities list in the AI prompt output box.

#### Scenario: Starter HTML download with Quill enabled
- **WHEN** the user downloads starter HTML while `#chk-quill` is checked
- **THEN** the generated standalone HTML bundle includes the Quill Snow CSS stylesheet and Quill JS bundle in `<head>`, plus sample rich text editor initialization in `<body>`.

### Requirement: Dual-Mode Simple and Complex Board Goals Authoring
Under "Describe what you want to build" -> "Tell what the board needs to show", the wizard MUST provide a mode switcher between Simple (plain `<textarea>`) and Complex (Quill CDN WYSIWYG editor).

#### Scenario: Switching between simple and complex modes
- **WHEN** user clicks the "Complex (Quill)" mode tab or toggle button
- **THEN** the plain textarea is replaced by the interactive Quill Snow editor toolbar and editable container.

#### Scenario: Switching back to simple mode
- **WHEN** user clicks the "Simple" mode tab or toggle button
- **THEN** the Quill container is replaced by the plain textarea with sanitized plain-text content preserved.

### Requirement: Bidirectional Synchronization and Persistence
Content entered in either Simple or Complex mode MUST be synchronized bidirectionally and persisted across browser sessions.

#### Scenario: Synchronizing from simple to complex mode
- **WHEN** user types plain-text notes into the simple textarea and toggles to complex mode
- **THEN** the Quill editor instance is populated with paragraphs reflecting the simple text.

#### Scenario: Synchronizing from complex to simple mode
- **WHEN** user edits rich text in Quill (including bold, italic, or lists) and toggles to simple mode
- **THEN** the simple textarea receives plain-text formatted content reflecting the rich text.

#### Scenario: LocalStorage persistence
- **WHEN** user inputs text in either mode and refreshes or reopens `create.html`
- **THEN** the saved board goals and active mode selection (simple or complex) are restored from `localStorage`.

### Requirement: Agent Prompt Synthesis with Board Goals
The generated AI agent prompt MUST incorporate user goals whether composed in simple mode or complex rich-text mode.

#### Scenario: Generating prompt from complex rich-text goals
- **WHEN** user composes structured requirements using lists and bold emphasis in complex mode
- **THEN** `#prompt-output-box` incorporates the formatted requirements into the "Objective & Scope" section and instructs the scaffolding agent to construct widgets satisfying those requirements.
