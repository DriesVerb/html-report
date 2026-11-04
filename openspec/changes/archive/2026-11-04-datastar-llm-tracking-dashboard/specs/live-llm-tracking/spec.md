# Capability Delta: Live LLM Tracking Dashboard & Showdown Artifact Viewer

## ADDED REQUIREMENTS

### Requirement: Dev Server Markdown Resolution & MIME Handling
The dev server (`serve-report.mjs`) MUST support `text/markdown; charset=utf-8` and automatically resolve markdown artifact links (`/proposal.md`, `/design.md`, `/tasks.md`, `/specs/...`) against the active OpenSpec change directory if they do not exist at root.

#### Scenario: Requesting Artifact Markdown File
- **GIVEN** a dev server running against `implementation-progress.html` with an active change in `openspec/changes/<feature-name>/`
- **WHEN** a client makes an HTTP GET request to `/proposal.md`
- **THEN** the server MUST resolve the file from `openspec/changes/<feature-name>/proposal.md` and respond with status 200 and `Content-Type: text/markdown; charset=utf-8`.

---

### Requirement: Showdown In-Browser Markdown Artifact Viewer
The standard report MUST provide an interactive Showdown-powered modal viewer allowing users to click `.md` artifact buttons and view formatted GitHub Flavored Markdown with syntax highlighting and task checklists without leaving the page or downloading raw files.

#### Scenario: Clicking Markdown Artifact Link
- **GIVEN** a user viewing the journey dashboard in the browser
- **WHEN** the user clicks any artifact button (`proposal.md`, `design.md`, `tasks.md`, or `specs/`)
- **THEN** the report MUST open `<dialog id="markdown-viewer-modal">` and render the document's content using Showdown with GFM tables, tasklists, and code blocks.

#### Scenario: Switching Between Artifact Tabs
- **GIVEN** the markdown viewer modal is open
- **WHEN** the user clicks another tab in the modal header (e.g. `design.md` or `tasks.md`)
- **THEN** the viewer MUST seamlessly switch content and render the selected artifact.

---

### Requirement: Datastar Live LLM Tracking Dashboard
The report MUST provide real-time hypermedia tracking components powered by Datastar.js and SSE (`/__datastar_stream__`) displaying LLM thoughts, tool calls, and task progress.

#### Scenario: Live Chain-of-Thought Stream
- **GIVEN** an active Datastar stream connection
- **WHEN** an agent emits a thought delta event
- **THEN** Datastar MUST append or morph the thought into `#agent-thought-stream` without page reload.

#### Scenario: Live Tool Invocation & Terminal Output
- **GIVEN** an active Datastar stream connection
- **WHEN** a tool call event is received
- **THEN** Datastar MUST prepend a tool invocation card to `#tool-call-feed` displaying tool name, arguments, status indicator, and collapsible terminal output drawer.

#### Scenario: Real-Time Task Card Morphing
- **GIVEN** a task item `#task-${id}` in the dashboard
- **WHEN** the server broadcasts a `datastar-fragment` with `selector: #task-${id}` and updated status
- **THEN** Datastar MUST morph the task card in-place, updating the status badge, checkbox, and completion state.
