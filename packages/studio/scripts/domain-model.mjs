/**
 * @file domain-model.mjs
 * Canonical domain decision model and deterministic prompt generator for html-create.
 * Barrel re-exporting studio config & DDD glossary from lib/domain/*.
 * Zero external npm dependencies.
 */

export {
  DAISYUI_THEMES,
  TARGET_DEFINITIONS,
  CORE_CDN_STACK,
  ADDON_CATALOG,
  ADDON_ALIASES,
  normalizeAddonKey,
  WIDGET_PRESETS,
  normalizeTarget,
  normalizeDomainConfig,
  resolveSiblingSkill,
  generateCliCommand,
  generateDeterministicPrompt
} from "./lib/domain/studio-config.mjs";

export {
  BOUNDED_CONTEXTS,
  UBIQUITOUS_GLOSSARY,
  FEATURE_BENEFICIARIES,
  SERVING_MODES,
  BEHAVIORAL_MODES,
  FEATURE_ALIGNMENT_RUBRIC,
  evaluateFeatureAlignment,
  generateFeatureAlignmentPrompt
} from "./lib/domain/ddd-glossary.mjs";
