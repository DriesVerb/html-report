# page-edit-selection Specification

## Purpose

Provides an interactive DOM element picker in the authoring edit dock that allows users to visually inspect and select elements with zero-reflow hover highlights, ensures unique element IDs, and attaches target element references to tasks.

## Requirements

### Requirement: Selection mode toggle
The authoring edit dock SHALL provide a select mode toggle button positioned next to the add task button that switches element inspection mode on and off.

#### Scenario: Toggle activation and deactivation
- **WHEN** user clicks the select button in the edit dock bar
- **THEN** selection mode activates, setting crosshair cursor and highlighting the button; clicking it again or pressing Escape deactivates selection mode.

### Requirement: Zero-reflow invert hover highlight
In selection mode, hovering over report content elements SHALL apply an isolated color inversion filter with zero layout shift or dimensional reflow, active strictly while selection mode is active.

#### Scenario: Hover color inversion with zero layout shift
- **WHEN** user moves the cursor over an element while selection mode is active
- **THEN** the element displays an inverted color filter without changing its width, height, margin, or padding, and the filter is removed when the cursor leaves.

### Requirement: Safe boundary and keyboard escape
The edit dock, modals, and settings menus SHALL be excluded from selection mode interactions, and pressing Escape SHALL immediately exit selection mode and restore normal browsing.

#### Scenario: Escape key cancels selection
- **WHEN** selection mode is active and user presses Escape
- **THEN** selection mode immediately exits, removing hover filters and resetting the cursor to default.

### Requirement: Just-in-time semantic ID assignment
When an element is clicked in selection mode, the system SHALL use its existing ID or assign a clean, unique semantic ID to the element if none exists.

#### Scenario: Assign unique ID when missing
- **WHEN** user clicks an element in selection mode that lacks an id attribute
- **THEN** a unique semantic ID based on tag and text slug is assigned directly to the element and captured as the task target.

### Requirement: Compose menu target badge without autofill
Selecting an element SHALL exit selection mode, switch to the compose pane, and display a dismissible target element badge while leaving title and content inputs unmodified without autofill.

#### Scenario: Target badge displayed and inputs empty
- **WHEN** an element is selected in selection mode
- **THEN** selection mode turns off, compose pane is displayed showing the target badge with the element ID, and task title and content inputs remain empty without autofill.

### Requirement: Target element in deterministic prompt
Tasks with an attached target element SHALL include the target element selector and tag in the generated deterministic prompt output.

#### Scenario: Prompt output includes target element metadata
- **WHEN** a task with an attached target element is included in prompt generation
- **THEN** the generated prompt text formats the task with its target element selector and tag.
