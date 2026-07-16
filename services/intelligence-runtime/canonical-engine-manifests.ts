import type { SemVerString } from "@/services/intelligence";
import type { EngineManifest } from "./engine-manifest";

/**
 * Genesis Phase 2 — Increment 2. The minimum truthful set of `EngineManifest`
 * declarations justified by current repository evidence, per
 * `docs/genesis-phase-2/18_INCREMENT_2_ENGINE_MANIFEST_REGISTRY.md`'s "Initial canonical
 * manifests" section (read that document for the full per-engine evaluation, including
 * why `risk`, `data-quality`, and `evidence` are evaluated but NOT declared here).
 *
 * Every manifest below is `status: "planned"` — none of Phase 1's eleven canonical
 * engine ids has a canonical (`services/intelligence`-consuming) adapter implementation
 * yet. A legacy, uncoordinated implementation existing in `services/*-engine.ts` is not
 * the same as the canonical engine being "active" (Principle 6, `04_ENGINE_LIFECYCLE.md`).
 *
 * `dependencies` is `[]` on every manifest below, even where the frozen dependency graph
 * (`12_DEPENDENCY_GRAPH.md`) names a future relationship (e.g. Recommendation depending
 * on a Score adapter) — `07_ENGINE_MANIFEST.md`'s own rule is that a dependency "becomes
 * declarable" only once the depended-upon engine itself has an adapter, and no adapter
 * exists yet for any engine in this increment.
 */

const v0_1_0 = { major: 0, minor: 1, patch: 0, prerelease: null, build: null } as const;
const v1_0_0 = { major: 1, minor: 0, patch: 0, prerelease: null, build: null } as const;

const DATA_TRUST_MANIFEST: EngineManifest = {
  id: "data-trust",
  name: "Data Trust Score Engine",
  description:
    "Canonical Data Trust Score engine (02_CANONICAL_DOMAIN_MODEL.md). Not yet implemented " +
    "at the canonical layer: a legacy rule-based implementation exists at " +
    "services/data-trust-engine.ts (0-100 trustScore, persisted to site_trust_scores), but " +
    "no Data Trust Score Adapter (08_ADAPTER_STRATEGY.md adapter #2, Increment 4) has been " +
    "built yet, so this declaration is 'planned', not 'active'.",
  status: "planned",
  version: {
    engineVersion: v0_1_0,
    contractVersion: v1_0_0,
    minimumCompatibleVersion: v1_0_0,
    deprecatedSince: null,
    breakingChanges: [],
  },
  capabilities: ["data trust score"],
  owner: "Genesis Phase 2",
  engineVersion: "0.1.0" as SemVerString,
  contractVersion: "1.0.0" as SemVerString,
  configurationVersion: "0.1.0",
  capabilityKey: "data_trust",
  inputs: [{ name: "site", shape: 'EntityReference<"Site">', required: true }],
  outputs: [{ name: "score", shape: 'Score<"data-trust">', required: true }],
  dependencies: [],
  supportsPreview: true,
  supportsPersistence: true,
  supportsBatch: true,
  maxBatchSize: 5000,
  supportedScopes: ["site"],
  securityRequirement: "privileged-recalculation",
  observability: {
    emitsEvents: ["DATA_TRUST_RECALCULATED", "DATA_TRUST_BATCH_RECALCULATED"],
    healthCheck: "dependency-chain",
  },
};

const CONFIDENCE_MANIFEST: EngineManifest = {
  id: "confidence",
  name: "Confidence Engine (canonical, reserved)",
  description:
    "Canonical per-score 'Confidence' concept (02_CANONICAL_DOMAIN_MODEL.md), reserved and " +
    "unimplemented (ADR-004, 15_ARCHITECTURE_DECISIONS.md). services/confidence-engine.ts " +
    "already exists in the legacy layer, but ADR-004 determined its actual behavior " +
    "(per-Site field-completeness) matches canonical Trust-input semantics, not canonical " +
    "Confidence semantics — this manifest does NOT wrap services/confidence-engine.ts. It " +
    "declares the genuinely distinct future engine ADR-004 reserves this id for.",
  status: "planned",
  version: {
    engineVersion: v0_1_0,
    contractVersion: v1_0_0,
    minimumCompatibleVersion: v1_0_0,
    deprecatedSince: null,
    breakingChanges: [],
  },
  capabilities: ["per-score confidence assessment (reserved, ADR-004)"],
  owner: "Genesis Phase 2",
  engineVersion: "0.1.0" as SemVerString,
  contractVersion: "1.0.0" as SemVerString,
  configurationVersion: "0.1.0",
  capabilityKey: "confidence_scoring",
  inputs: [{ name: "score", shape: "Score<string>", required: true }],
  outputs: [{ name: "confidence", shape: "UnitInterval", required: true }],
  dependencies: [],
  supportsPreview: false,
  supportsPersistence: false,
  supportsBatch: false,
  maxBatchSize: null,
  supportedScopes: ["site"],
  securityRequirement: "authenticated-read",
  observability: { emitsEvents: [], healthCheck: "none" },
};

const RECOMMENDATION_MANIFEST: EngineManifest = {
  id: "recommendation",
  name: "Recommendation Engine (canonical, adapter not yet built)",
  description:
    "Canonical Recommendation engine (02_CANONICAL_DOMAIN_MODEL.md). Recommendation-shaped " +
    "output already exists scattered across legacy services (e.g. " +
    "data-trust-engine.ts's recommendation() text, the Data Trust dashboard's alert list), " +
    "but no canonical Recommendation Adapter exists yet (08_ADAPTER_STRATEGY.md adapter #4, " +
    "Increment 6). This manifest declares the concept only.",
  status: "planned",
  version: {
    engineVersion: v0_1_0,
    contractVersion: v1_0_0,
    minimumCompatibleVersion: v1_0_0,
    deprecatedSince: null,
    breakingChanges: [],
  },
  capabilities: ["site recommendation (reserved for Increment 6 adapter)"],
  owner: "Genesis Phase 2",
  engineVersion: "0.1.0" as SemVerString,
  contractVersion: "1.0.0" as SemVerString,
  configurationVersion: "0.1.0",
  capabilityKey: "recommendation_engine",
  inputs: [{ name: "score", shape: "Score<string>", required: true }],
  outputs: [{ name: "recommendation", shape: "Recommendation", required: true }],
  dependencies: [],
  supportsPreview: false,
  supportsPersistence: false,
  supportsBatch: false,
  maxBatchSize: null,
  supportedScopes: ["site"],
  securityRequirement: "authenticated-read",
  observability: { emitsEvents: [], healthCheck: "none" },
};

/** Registration order = deterministic declaration order (`registry-instance.ts`). */
export const CANONICAL_ENGINE_MANIFESTS: readonly EngineManifest[] = [
  DATA_TRUST_MANIFEST,
  CONFIDENCE_MANIFEST,
  RECOMMENDATION_MANIFEST,
];
