# page-edit-queue Specification

## Purpose
Defines the bottom-docked page-edit prompt editor, queued task CRUD with priority, and AI prompt export workflow.

## Requirements

### Requirement: Bottom-docked editor

The system SHALL satisfy: The editor sits at the bottom edge, stays compact (collapsed 40px, expanded max 38vh), and never covers page content.

#### Scenario: Bottom-docked editor verified

- **WHEN** a user opens a generated report and exercises this behavior
- **THEN** the editor sits at the bottom edge, stays compact (collapsed 40px, expanded max 38vh), and never covers page content.

### Requirement: Task CRUD with priority

The system SHALL satisfy: Users can create tasks with title and content, edit/delete them, mark done, and set/reorder priority.

#### Scenario: Task CRUD with priority verified

- **WHEN** a user opens a generated report and exercises this behavior
- **THEN** users can create tasks with title and content, edit/delete them, mark done, and set/reorder priority.

### Requirement: Queue tab overview

The system SHALL satisfy: A tab lists all tasks ordered by priority with counts, and supports reprioritizing.

#### Scenario: Queue tab overview verified

- **WHEN** a user opens a generated report and exercises this behavior
- **THEN** a tab lists all tasks ordered by priority with counts, and supports reprioritizing.

### Requirement: Scroll-following context

The system SHALL satisfy: The dock shows the section currently in view, anchors new tasks to it, and jumps to a task's anchor on click.

#### Scenario: Scroll-following context verified

- **WHEN** a user opens a generated report and exercises this behavior
- **THEN** the dock shows the section currently in view, anchors new tasks to it, and jumps to a task's anchor on click.

### Requirement: Deterministic prompt

The system SHALL satisfy: Generating a prompt from identical tasks always yields identical text; done tasks are excluded; order follows priority.

#### Scenario: Deterministic prompt verified

- **WHEN** a user opens a generated report and exercises this behavior
- **THEN** generating a prompt from identical tasks always yields identical text; done tasks are excluded; order follows priority.

### Requirement: Agent hand-off states

The system SHALL satisfy: Connected+AI sends to the agent; AI-capable but disconnected offers the turnkey reconnect; otherwise copy-only.

#### Scenario: Agent hand-off states verified

- **WHEN** a user opens a generated report and exercises this behavior
- **THEN** connected+AI sends to the agent; AI-capable but disconnected offers the turnkey reconnect; otherwise copy-only.

### Requirement: Persistence

The system SHALL satisfy: Tasks survive reloads per page and never leak between pages.

#### Scenario: Persistence verified

- **WHEN** a user opens a generated report and exercises this behavior
- **THEN** tasks survive reloads per page and never leak between pages.

### Requirement: Auto-priority prompt synthesis

The system SHALL satisfy: The queue tab provides an auto-priority toggle switch; when enabled, the generated prompt instructs the AI agent to determine its own execution priority order across the tasks.

#### Scenario: Auto-priority instruction included in prompt

- **WHEN** the auto-priority toggle is active during prompt generation
- **THEN** the generated prompt appends an instruction under Constraints directing the AI agent to determine its own optimal execution priority order.

### Requirement: Stale prompt invalidation and gated copy

The system SHALL satisfy: The copy prompt button is disabled until a prompt has been explicitly generated; any queue modification (adding, editing, reordering, deleting tasks, or toggling auto-priority) resets the generated prompt, hides the preview, and disables the copy button with an explanatory tooltip.

#### Scenario: Copy button disabled on queue change

- **WHEN** tasks enter the queue or existing tasks are modified after prompt generation
- **THEN** the active prompt preview is reset and the copy button is disabled until the user generates a fresh prompt.

### Requirement: Darkmode and narrow-viewport visibility

The system SHALL satisfy: The docked editor maintains high visual contrast in darkmode with top border accents, ring outlines, and upward drop shadows; on narrow viewports, control elements maintain fixed width while task titles and section anchor badges stay readable without disappearing.

#### Scenario: High-contrast docked editor in darkmode and narrow viewports

- **WHEN** a user views the editor in a dark theme or on a small screen
- **THEN** the dock remains distinctly visible from page content and task titles/anchors remain readable.
