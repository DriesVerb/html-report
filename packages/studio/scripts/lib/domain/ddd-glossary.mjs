/**
 * @file lib/domain/ddd-glossary.mjs
 * Ubiquitous language glossary, bounded contexts, feature beneficiaries,
 * serving/behavioral taxonomies, and OpenSpec feature alignment evaluator.
 */

export const BOUNDED_CONTEXTS = {
  assembly: {
    key: "assembly",
    name: "1. Assembly: The Fusion Engine",
    description: "Everything we need to put the pieces together fast and reliably (Semantic Fragment + Template Shell + Assets).",
    primaryArtifacts: ["template-shell.html", "harness.mjs"]
  },
  pipeline: {
    key: "pipeline",
    name: "2. Pipeline: The State Machine Orchestrator",
    description: "The state machine around assembly ensuring speed and correctness (FSM, pre-flight normalizer, addon detection).",
    primaryArtifacts: ["build-report.mjs", "harness.mjs", "serve-report.mjs"]
  },
  deliveryArchetypes: {
    key: "deliveryArchetypes",
    name: "3. Delivery Archetypes: Goal-Driven Destinations",
    description: "The results our skills work toward, knowing what they need to become with mapped journeys and custom support.",
    primaryArtifacts: ["skills/html-report", "skills/html-dashboard", "skills/html-presentation", "skills/html-print", "skills/html-pwa"]
  },
  createMode: {
    key: "createMode",
    name: "4. Create Mode: Guided Intent Resolution",
    description: "Guiding users in Studio or CLI to their desires via the quickest combination of assembly, pipeline, and archetype.",
    primaryArtifacts: ["create.html", "html-grill.mjs", "open-create.sh"]
  },
  editMode: {
    key: "editMode",
    name: "5. Edit Mode: In-Flight Draft Adjustments",
    description: "Where users and agents make adjustments to a product that is not yet published (selection canvas, task queue, agent bridge).",
    primaryArtifacts: ["report-runtime.js", "agent-bridge.js"]
  },
  publishedDocument: {
    key: "publishedDocument",
    name: "6. Published Document: Final End-Product",
    description: "The finished document seen by the user that no longer needs edit-mode, pruning authoring chrome cleanly.",
    primaryArtifacts: ["build-report.mjs (--published)", "template-shell.html"]
  },
  openSpecJourney: {
    key: "openSpecJourney",
    name: "7. OpenSpec Journey: Living Dev Loop",
    description: "The 5-phase lifecycle connecting brainstorming, planning, implementation, verification, and live mirroring on :3031.",
    primaryArtifacts: ["GEMINI.md", "AGENTS.md", "openspec/changes/*/index.html", "implementation-progress.html"]
  },
  coreAssembly: {
    key: "coreAssembly",
    name: "1. Assembly: The Fusion Engine",
    description: "Everything we need to put the pieces together fast and reliably.",
    primaryArtifacts: ["template-shell.html", "harness.mjs"]
  },
  themeAdaptation: {
    key: "themeAdaptation",
    name: "Theme Adaptation & OKLCH Engine",
    description: "Perceptually uniform color math, 32 DaisyUI themes (defaulting to light).",
    primaryArtifacts: ["theme-compiler.mjs"]
  },
  agentBridge: {
    key: "agentBridge",
    name: "Two-Way AI Agent Bridge & Telemetry",
    description: "Bidirectional hypermedia bridge and SSE streams.",
    primaryArtifacts: ["agent-bridge.js"]
  },
  inBrowserAuthoring: {
    key: "inBrowserAuthoring",
    name: "In-Browser Authoring & Co-Design",
    description: "Collapsible edit dock (#edit-dock) and canvas inspector.",
    primaryArtifacts: ["report-runtime.js"]
  },
  studioDiscovery: {
    key: "studioDiscovery",
    name: "Studio & Discovery Hub",
    description: "Creation studio wizard and workspace scanner.",
    primaryArtifacts: ["create.html"]
  }
};

export const UBIQUITOUS_GLOSSARY = [
  {
    canonical: "Assembly",
    deprecated: ["raw stitching", "file concat", "glue step"],
    boundedContext: "assembly",
    rule: "The fast, reliable engine that joins the Semantic Fragment, Template Shell, and assets into an assembled document."
  },
  {
    canonical: "Pipeline",
    deprecated: ["build runner", "compiler script", "bundler loop"],
    boundedContext: "pipeline",
    rule: "The state machine orchestrating pre-flight checks, addon detection, caching, and post-processing around assembly."
  },
  {
    canonical: "Delivery Archetypes",
    deprecated: ["report kinds", "template modes", "output flavors"],
    boundedContext: "deliveryArchetypes",
    rule: "Goal-driven destinations (@html-report, @html-dashboard, etc.) that know what they need to become."
  },
  {
    canonical: "Create Mode",
    deprecated: ["wizard form", "setup screen", "init step"],
    boundedContext: "createMode",
    rule: "Guided Studio/CLI intent resolution finding the quickest combination of assembly, pipeline, and archetype."
  },
  {
    canonical: "Edit Mode",
    deprecated: ["admin bar", "inspector tool", "bottom toolbar"],
    boundedContext: "editMode",
    rule: "In-flight product workspace (#edit-dock) for making adjustments to an unpublished document."
  },
  {
    canonical: "Published Document",
    deprecated: ["clean HTML", "production build", "stripped export"],
    boundedContext: "publishedDocument",
    rule: "The finalized end-product that no longer needs edit-mode, with authoring chrome cleanly pruned."
  },
  {
    canonical: "Output Deliverable",
    deprecated: ["compiled HTML", "artifact file", "final page"],
    boundedContext: "assembly",
    rule: "The resulting standalone, single-file HTML5 document generated by the deterministic build harness."
  },
  {
    canonical: "OpenSpec Journey",
    deprecated: ["dev process", "git branch flow", "sprint tracker"],
    boundedContext: "openSpecJourney",
    rule: "The 5-stage evolution cycle (Brainstorming to Archived) mirrored live on localhost:3031."
  },
  {
    canonical: "Semantic Fragment",
    deprecated: ["snippet", "HTML body", "partial", "template content"],
    boundedContext: "assembly",
    rule: "Pure <main id=\"report-main\"> HTML content emitted by LLMs without doctype or shell boilerplate."
  },
  {
    canonical: "Template Shell",
    deprecated: ["layout", "wrapper", "scaffold", "base HTML"],
    boundedContext: "assembly",
    rule: "The pre-bundled DaisyUI 4/Tailwind/Alpine container document (template-shell.html)."
  },
  {
    canonical: "Two-Way Agent Bridge",
    deprecated: ["co-pilot socket", "agent webhook", "chat connector"],
    boundedContext: "editMode",
    rule: "Runtime bidirectional channel (window.HTMLReportAgent) connecting browser UI to active agent CLI session."
  },
  {
    canonical: "Target Element",
    deprecated: ["picked card", "clicked node", "DOM hook"],
    boundedContext: "editMode",
    rule: "DOM node selected via canvas click, receiving an immutable slug via getOrAssignId()."
  },
  {
    canonical: "Artifact Quad",
    deprecated: ["planning docs", "spec files", "markdown set"],
    boundedContext: "openSpecJourney",
    rule: "The 4 mandatory planning documents: proposal.md, design.md, tasks.md, specs/."
  }
];

export const FEATURE_BENEFICIARIES = {
  user: {
    key: "user",
    name: "User-Facing (Human-Centric)",
    description: "Visual Studio GUI (create.html), theme pickers, Quill rich editor, responsive layouts, printable PDFs, aesthetic UX."
  },
  agent: {
    key: "agent",
    name: "Agent-Facing (Agent-Centric)",
    description: "Headless CLI commands, token-saving semantic fragments, mechanical auto-repairs, JSON schemas, Turnkey reconnect prompts."
  },
  hybrid: {
    key: "hybrid",
    name: "Hybrid (Human + Agent Loop)",
    description: "Two-Way Agent Bridge, Edit Mode Dock (human targets element, agent receives synthesized prompt)."
  }
};

export const SERVING_MODES = {
  staticFile: {
    key: "staticFile",
    name: "Static File (Zero Backend)",
    description: "file:///, static CDN, or GitHub Pages. Zero dedicated server required. Client-side fetch to external CORS APIs supported."
  },
  serverConnected: {
    key: "serverConnected",
    name: "Server-Connected (Live Backend)",
    description: "Backed by serve-report.mjs on localhost:3031. Real-time Datastar SSE hypermedia morphs, file-watch hot-reload, agent bridge."
  }
};

export const BEHAVIORAL_MODES = {
  passive: {
    key: "passive",
    name: "Passive / Printable Document",
    description: "Fixed structure for reading, paper export, and @page A4/Letter PDF rendering."
  },
  interactive: {
    key: "interactive",
    name: "Interactive / Reactive Application",
    description: "Dynamic user or data interaction: client-side Alpine filters, Chart.js animations, public API fetches, or live SSE streams."
  }
};

export const FEATURE_ALIGNMENT_RUBRIC = [
  { step: 1, name: "Context Attribution", description: "Declares User-Facing, Agent-Facing, or Hybrid, and attributes to a primary subsystem." },
  { step: 2, name: "Ubiquitous Vocabulary", description: "Uses canonical domain terms and avoids deprecated synonyms." },
  { step: 3, name: "Archetype Impact", description: "Specifies target Delivery Archetype and Serving/Behavioral mode." },
  { step: 4, name: "Bridge & Authoring Invariants", description: "Defines agent bridge, edit mode, and published mode expectations." },
  { step: 5, name: "Journey & Live Mirror", description: "Links the 4-file Artifact Quad and updates localhost:3031." }
];

export function evaluateFeatureAlignment(proposal = {}) {
  const violations = [];
  const checks = [];

  const hasValidContext = Boolean(
    proposal.boundedContext &&
    (BOUNDED_CONTEXTS[proposal.boundedContext] || Object.values(BOUNDED_CONTEXTS).some((bc) => bc.name === proposal.boundedContext || bc.key === proposal.boundedContext))
  );
  if (!hasValidContext) {
    violations.push("Feature proposal must declare a valid primary Bounded Context / Core Subsystem.");
  }
  checks.push({ step: 1, name: "Context Attribution", passed: hasValidContext });

  const fullText = `${proposal.title || ""} ${proposal.description || ""} ${proposal.content || ""}`.toLowerCase();
  const foundDeprecated = [];
  for (const entry of UBIQUITOUS_GLOSSARY) {
    for (const syn of entry.deprecated) {
      if (fullText.includes(syn.toLowerCase())) {
        foundDeprecated.push(`"${syn}" (use "${entry.canonical}" instead)`);
      }
    }
  }
  const vocabularyPassed = foundDeprecated.length === 0;
  if (!vocabularyPassed) {
    violations.push(`Proposal contains deprecated domain synonyms: ${foundDeprecated.join(", ")}`);
  }
  checks.push({ step: 2, name: "Ubiquitous Vocabulary", passed: vocabularyPassed, details: foundDeprecated });

  const archetypes = proposal.archetypes || proposal.deliveryArchetypes || [];
  const hasArchetypes = Array.isArray(archetypes) && archetypes.length > 0;
  checks.push({ step: 3, name: "Archetype Impact", passed: hasArchetypes });
  if (!hasArchetypes) {
    violations.push("Proposal must declare at least one target Delivery Archetype (e.g. @html-report, @html-dashboard).");
  }

  const hasBridgeSpec = proposal.agentBridgeImpact !== undefined || proposal.hasAuthoringImpact !== undefined || proposal.invariants !== undefined;
  checks.push({ step: 4, name: "Bridge & Authoring Invariants", passed: hasBridgeSpec });
  if (!hasBridgeSpec) {
    violations.push("Proposal must specify invariants regarding Agent Bridge or Authoring/Published mode.");
  }

  const hasArtifacts = Boolean(proposal.artifacts || proposal.artifactQuad || proposal.changeDir);
  checks.push({ step: 5, name: "Journey & Live Mirror", passed: hasArtifacts });
  if (!hasArtifacts) {
    violations.push("Proposal must reference OpenSpec Artifact Quad and live mirror on localhost:3031.");
  }

  const passedCount = checks.filter((c) => c.passed).length;
  const score = Math.round((passedCount / checks.length) * 100);

  return {
    aligned: violations.length === 0,
    score,
    checks,
    violations
  };
}

export function generateFeatureAlignmentPrompt(input = {}) {
  const title = input.title || "Proposed Feature";
  const bcKey = input.boundedContext || "assembly";
  const bc = BOUNDED_CONTEXTS[bcKey] || { name: bcKey };
  const beneficiaryKey = input.beneficiary || "user";
  const beneficiary = FEATURE_BENEFICIARIES[beneficiaryKey] || { name: beneficiaryKey };
  const servingMode = input.servingMode || "staticFile";
  const behavioralMode = input.behavioralMode || "interactive";
  const archetypes = input.archetypes && input.archetypes.length > 0 ? input.archetypes.join(", ") : "@html-report";
  const invariants = input.invariants || "Standard invariants applied.";

  return [
    `### OpenSpec Feature Proposal: ${title}`,
    "",
    "**Target Beneficiary:**",
    beneficiary.name,
    "",
    "**Primary Core Subsystem:**",
    bc.name,
    "",
    "**Runtime Classification (Two-Axis):**",
    `- Serving Mode: ${SERVING_MODES[servingMode]?.name || servingMode}`,
    `- Behavioral Mode: ${BEHAVIORAL_MODES[behavioralMode]?.name || behavioralMode}`,
    "",
    "**Applicable Delivery Archetypes:**",
    archetypes,
    "",
    "**Invariants & Domain Boundaries:**",
    invariants,
    "",
    "**Verification & Quality Gate:**",
    "- [ ] Conforms to the 5-Step Feature Alignment Rubric",
    "- [ ] Maintains zero token waste using Semantic Fragments (<main id=\"report-main\">)",
    "- [ ] Compiles via Deterministic Assembly (<100ms)",
    "- [ ] Distinguishes between In-Flight Draft (Edit Mode) vs Finalized Export (Published Document)",
    "- [ ] Mirrors live journey state to http://localhost:3031 via implementation-progress.html"
  ].join("\n");
}
