# Tasks: Datastar Live LLM Tracking Dashboard & Showdown Markdown Artifact Viewer

## Phase 1: Dev Server Markdown Resolution & Showdown In-Browser Artifact Viewer
- [x] 1.1 Update `skills/html-report/scripts/serve-report.mjs` to add `text/markdown` MIME support and resolve OpenSpec artifact files (`proposal.md`, `design.md`, `tasks.md`, `specs/`) from active change directories
- [x] 1.2 Build interactive Showdown markdown viewer modal in companion fragment with document switcher tabs, copy button, and GFM styling
- [x] 1.3 Verify clicking artifact buttons in the report immediately renders publication-grade markdown without 404s or download prompts

## Phase 2: Datastar Live Telemetry Engine & Live Tracking Dashboard Components
- [x] 2.1 Assemble live tracking dashboard components: agent thought stream (`#agent-thought-stream`), live tool invocation feed (`#tool-call-feed`), and responsive task cards (`#task-matrix`)
- [x] 2.2 Wire Datastar reactive signals and SSE fragment morphing (`/__datastar_stream__`) with automatic Lucide icon rehydration
- [x] 2.3 Implement DaisyUI journey phase stepper (`#journey-stepper`) adhering to the responsive horizontal overflow standard

## Phase 3: Telemetry Streamer CLI & Live Interactive Simulation Controls
- [x] 3.1 Create `skills/html-report/scripts/telemetry-streamer.mjs` to stream real agent transcript steps or synthetic LLM events into `/__datastar_stream__`
- [x] 3.2 Add in-browser interactive simulation controls (Simulate LLM Burst, Single Step, Play/Pause, Reset) for instant live demonstration

## Phase 4: Companion Dashboard Assembly & Live Dev Server Sync (`localhost:3000`)
- [x] 4.1 Compile `openspec/changes/datastar-llm-tracking-dashboard/index.html` using `build-report.mjs` with `--live` and Showdown addons
- [x] 4.2 Mirror to `implementation-progress.html` and verify live-reload on `http://localhost:3000`

## Phase 5: Verification & Playwright Validation
- [x] 5.1 Run Playwright validation checks verifying DOM structure, responsiveness, and zero console errors
- [x] 5.2 Test live streaming events and confirm real-time DOM morphing and markdown viewer functionality on `localhost:3000`
