# Proposal: Datastar Live LLM Tracking Dashboard & Showdown Markdown Artifact Viewer

## Why
When developers and agents work on features in this repository, they need real-time, high-fidelity visibility into what the LLM is doing:
1. **Live LLM Execution Blindspot**: As autonomous agents (Google Antigravity, OpenAI Codex, etc.) execute multi-step changes, users cannot see the live reasoning (Chain-of-Thought), tool invocations (commands, file operations, subagents), execution durations, or subtask progress without inspecting raw CLI logs or JSONL files.
2. **Broken Markdown Artifact Backlinks**: In feature companion dashboards (`index.html` and `implementation-progress.html`), the backlink buttons for markdown artifacts (`proposal.md`, `design.md`, `tasks.md`, `specs/`) fail when clicked in `localhost:3000`. The dev server returns 404 because the files reside in `openspec/changes/<feature>/`, and standard browsers do not format `.md` files nicely (often downloading them as `application/octet-stream`).
3. **Repository-Specific Need**: For this repo's development flow, having an integrated, Showdown-powered in-browser markdown viewer and a Datastar live tracking dashboard transforms the local dev server (`localhost:3000`) into a living command center that seamlessly tracks LLM activity and enables instant, beautiful inspection of OpenSpec artifacts.

## What Changes
1. **Showdown In-Browser Markdown Viewer & Dev Server Resolution**:
   - Upgrade `serve-report.mjs` to recognize `.md` files (`text/markdown; charset=utf-8`) and auto-resolve artifact requests (`/proposal.md`, `/design.md`, `/tasks.md`, `/specs/...`) against the active OpenSpec change directory.
   - Upgrade feature companion headers in `index.html` and `implementation-progress.html` with an interactive Showdown Markdown Viewer modal (`<dialog id="markdown-viewer-modal">`). Clicking any artifact button immediately renders publication-grade GitHub Flavored Markdown with syntax highlighting, task checkboxes, tables, and document switcher tabs without navigating away or downloading raw files.
   - Provide direct browser preview fallback so loading `.md` URLs directly renders a clean Showdown view.
2. **Datastar Live LLM Tracking Dashboard**:
   - Provide a real-time reactive dashboard using `@starfederation/datastar` and SSE (`/__datastar_stream__`).
   - Live Agent Thought Stream (`#agent-thought-stream`): Displays streaming Chain-of-Thought / reasoning text in real-time.
   - Live Tool Invocations Feed (`#tool-call-feed`): Renders tool calls (`read_file`, `run_command`, `write_file`, etc.) with running spinners, duration badges, arguments, and collapsible DaisyUI terminal drawers (`mockup-code`).
   - Live Task Progress Matrix (`#task-matrix`): Displays phases and tasks from `tasks.md`, morphing task cards in place upon status updates (`pending`, `running`, `completed`, `failed`).
   - Journey Phase Stepper (`#journey-stepper`): Publication-standard horizontal stepper showing current phase (`Brainstorming`, `Planning`, `Implementing`, `Verifying`, `Shipped`).
   - Live Metrics & Telemetry Controller: Interactive controls (Simulate Burst, Step, Play/Pause, Reset) and an active dev server bridge (`telemetry-streamer.mjs`) enabling live push from real agent executions.
