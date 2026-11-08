# Proposal: Settings Gear Menu Redesign & Tabbed Overview

## Why

The gear menu provides a single entry point for page settings, appearance, download, editing, and AI agent controls. However, displaying all theme swatches and download options expanded by default creates visual noise and clutters the dropdown on smaller screens. Furthermore, having a separate "Publishing" section disjoint from "Export" creates redundant workflows.

By redesigning the gear menu to start with an "All Settings" overview page/modal with categorized tabs, collapsing sections by default (while keeping the unexpanded appearance title equipped with the current color palette preview), renaming "Export" to "Download" with a built-in "Publish" switch, and removing the standalone publishing section, we create a calm, organized, and highly discoverable settings architecture.

## What Changes

1. **"All Settings" Hub**:
   - Add "All Settings" as the very first option at the top of the gear panel.
   - Clicking it opens an overview page/dialog with organized tabs:
     - **Appearance** (theme swatch selector and live palette preview)
     - **Download & Publishing** (publish mode switch, clean HTML export, PDF download, PWA)
     - **AI & Agent Bridge** (AI enablement switch, connection status, turnkey reconnection prompt)
     - **Page Editor** (authoring queue, prompt synthesis)

2. **Unexpanded Navbar / Gear Sections**:
   - All sections inside the gear panel are collapsed/unexpanded by default to keep the dropdown compact.
   - The unexpanded "Appearance" header keeps the current theme name and color palette preview (`bg-primary`, `bg-secondary`, `bg-accent`, `bg-neutral` dots).
   - Clicking expands the section to view details.

3. **Rename "Export" to "Download"**:
   - Update section header from "Export" to "Download".
   - Place a "Publish" toggle switch as the very first option inside this section.
   - Keep "Download as HTML" (and PDF / PWA) directly following the publish switch.

4. **Eliminate Standalone "Publishing" Option**:
   - Because publishing functionality and clean download are now directly integrated into the "Download" section, the separate standalone "Publishing" section is removed from the gear menu.

**Out of scope**
- No changes to TOC dropdown or agent-bridge status badge in the navbar.
- No changes to DaisyUI 32-theme definitions or underlying export generator logic.

## Capabilities

### Modified Capabilities
- `settings-gear-menu`: Evolved with "All Settings" tabbed overview modal, unexpanded collapsible sections with appearance color palette preview, unified "Download" section with built-in "Publish" switch, and elimination of the separate publishing section.

## Impact

- `skills/html-report/assets/template-shell.html`
- `skills/html-report/assets/report-runtime.js`
- `tests/settings-authoring.test.mjs`
- Companion journey page: [index.html](./index.html)
