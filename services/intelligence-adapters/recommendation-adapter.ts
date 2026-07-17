import type { Recommendation, EntityReference, Limitation } from "@/services/intelligence";
import type { RecommendationId } from "@/services/intelligence/types/identifiers";
import {
  toIdentifier,
  toIsoDateTime,
  validateEntityReferenceShape,
  validateRecommendationShape,
} from "@/services/intelligence";

/**
 * Genesis Phase 2 — Increment 6 (Recommendation Adapter).
 *
 * Pure, dependency-free translation from the legacy recommendation producers into
 * canonical `Recommendation` records (`services/intelligence/recommendations/recommendation.ts`),
 * per `docs/genesis-phase-2/08_ADAPTER_STRATEGY.md`'s adapter #4.
 *
 * THREE-SHAPE RECONCILIATION (the specific task `02_CANONICAL_DOMAIN_MODEL.md`'s
 * "Recommendation" section and `14_IMPLEMENTATION_ROADMAP.md` Increment 6 assign to this
 * adapter's own design doc — see
 * `docs/genesis-phase-2/22_INCREMENT_6_RECOMMENDATION_ADAPTER.md` Section 6 for the full
 * evidence trail): direct reading of `services/evidence-center-engine.ts` found its
 * `technicalRecommendation` field is `trust?.recommendation || <fallback>` — i.e. it
 * re-surfaces Data Trust's own string under a different field name, not an independently
 * computed third shape. This adapter therefore reconciles the **two** genuinely distinct,
 * independently-computed legacy producers:
 *
 *   1. `services/data-trust-engine.ts`'s `recommendation(score)` — a plain free-text string,
 *      no priority/impact/action structure, tied to one Site.
 *   2. `sentinel-core/recommendation/recommendation-engine.ts`'s `getRecommendations()` —
 *      `{ type, priority: number, title, evidence: object | null }` items, spanning four
 *      sub-types (`GLOBAL_RULE`, `LOW_TRUST`, `COPERNICUS_VALIDATION`,
 *      `ROLLOUT_OPPORTUNITY`), not all of which are about a single Site (`ROLLOUT_OPPORTUNITY`
 *      is about a municipality; `GLOBAL_RULE` is about nothing in particular).
 *
 * A broader repository search also found `app/api/site-recommendation/route.ts` (an ad hoc,
 * differently-shaped per-site array of strings plus separate `priority`/`expansionPotential`
 * fields), `sentinel-core/inference/inference-engine.ts`'s `sig_insights.recommendation`
 * (belongs to the distinct "Insight" concept), and `services/duplicates-engine.ts`'s
 * `DuplicateCandidate.recommendation` (belongs to the distinct, later-scheduled "Duplicate
 * Candidate" concept, `14_IMPLEMENTATION_ROADMAP.md`'s postponed-work list). None of these
 * three are consolidated by this increment — evaluated and explicitly excluded, not
 * silently missed; see the increment doc for the full reasoning.
 *
 * This module does not execute any engine, call any legacy producer, open a database, or
 * touch the Runtime Registry.
 */

export const LEGACY_RECOMMENDATION_TYPES = [
  "DATA_TRUST_TEXT",
  "GLOBAL_RULE",
  "LOW_TRUST",
  "COPERNICUS_VALIDATION",
  "ROLLOUT_OPPORTUNITY",
] as const;
export type LegacyRecommendationType = (typeof LEGACY_RECOMMENDATION_TYPES)[number];

/**
 * The narrowest truthful, unified structural shape covering both real legacy producers.
 * Hand-declared — no reusable named type exists for either producer's output anywhere in
 * the repository.
 *
 * `text` is the common "reason" analog: `data-trust-engine.ts`'s recommendation string
 * directly, or `sentinel-core`'s `title` field. `priority`/`evidenceContext` are `null` for
 * `DATA_TRUST_TEXT` (that source has neither concept) and populated verbatim, unparsed, for
 * the four `sentinel-core` sub-types.
 */
export interface LegacyRecommendationItem {
  readonly type: string;
  readonly text: string;
  readonly priority: number | null;
  readonly evidenceContext: Record<string, unknown> | null;
}

/**
 * Caller-supplied context this adapter cannot derive on its own.
 *
 * - `idSeed`: an independent, caller-chosen stable seed (not derived from
 *   `affectedEntities`, since a recommendation's natural entity anchor varies by legacy
 *   type — a Site for some, a Municipality for `ROLLOUT_OPPORTUNITY`, nothing at all for
 *   `GLOBAL_RULE` — deriving one implicitly from `affectedEntities[0]` would be a hidden,
 *   type-dependent assumption this adapter avoids by requiring an explicit seed instead,
 *   mirroring the Evidence Adapter's identical `idSeed` rationale).
 * - `affectedEntities`: the canonical `Recommendation.affectedEntities` requires a
 *   non-empty array of already-adapted `EntityReference`s (e.g. from Increment 3's Site
 *   Entity Adapter). This adapter never derives one itself from `evidenceContext`'s raw
 *   `siteId`/`municipio` fields — doing so would be exactly the kind of ad hoc, per-type
 *   inference the mission prohibits.
 * - `timestamp`: neither legacy producer carries a timestamp of its own.
 * - `version`: optional, defaults to this adapter's own static contract version if omitted.
 */
export interface RecommendationAdapterContext {
  readonly idSeed: string;
  readonly affectedEntities: readonly EntityReference[];
  readonly timestamp: string;
  readonly version?: string;
}

export type RecommendationAdaptationIssueCode =
  | "missing_reason"
  | "missing_id_seed"
  | "missing_affected_entities"
  | "invalid_affected_entity"
  | "missing_evaluated_at"
  | "invalid_timestamp"
  | "unrecognized_recommendation_type"
  | "invalid_legacy_priority"
  | "policy_default_values_applied"
  | "invalid_canonical_shape";

export interface RecommendationAdaptationIssue {
  readonly code: RecommendationAdaptationIssueCode;
  readonly field: string;
  readonly severity: "informational" | "moderate" | "significant";
  readonly message: string;
  readonly canContinue: boolean;
}

/** A narrow set of raw legacy values preserved for traceability. `rawEvidenceContext` is
 * the sentinel-core sub-object (or `null`), preserved verbatim and never parsed/interpreted. */
export interface RecommendationSourceReference {
  readonly rawType: string;
  readonly rawText: string;
  readonly rawPriority: number | null;
  readonly rawEvidenceContext: Record<string, unknown> | null;
}

export interface RecommendationAdaptationResult {
  readonly success: boolean;
  /** The canonical `Recommendation`, present only when `success` is `true`. Its presence
   * means "adaptation completed and the result is structurally valid" — it does **not**
   * mean the recommendation is well-prioritized, actionable, or factually correct.
   * `priority`/`confidence`/`impact` are adapter policy defaults, not measured legacy
   * signals — see `metadata.policyDefaultsApplied`, `limitations`, and the
   * `policy_default_values_applied` issue code. */
  readonly recommendation: Recommendation | null;
  readonly issues: readonly RecommendationAdaptationIssue[];
  readonly sourceReference: RecommendationSourceReference;
  /** `LegacyRecommendationItem` has no field without a canonical home (`text`, `priority`,
   * and `evidenceContext` all map to `reason`/`metadata`/`sourceReference`) — always empty
   * for this adapter, kept for interface consistency with the Site, Data Trust, and
   * Evidence adapters. */
  readonly unmappedFields: readonly string[];
}

export const RECOMMENDATION_ADAPTER_UNMAPPED_FIELDS: readonly string[] = [];

/** This adapter's own contract version, used only when `context.version` is omitted. Not
 * read from any manifest (no `RecommendationManifest` is declared by this increment). */
const RECOMMENDATION_ADAPTER_DEFAULT_VERSION = "0.1.0";

/** Neither legacy producer carries a genuine urgency/confidence/impact signal:
 * `data-trust-engine.ts`'s recommendation string has none at all, and
 * `sentinel-core/recommendation/recommendation-engine.ts`'s numeric `priority` is an
 * incidental sort/truncation ordinal (per-type constants 1/2/3, or `index + 1` for
 * `GLOBAL_RULE` ranging 1-6, `sentinel-core/recommendation/recommendation-rules.ts`) — not
 * a documented urgency scale, and its range is inconsistent across types. Mapping it to a
 * canonical priority level would be guessing at intent (Increment 4's Step 7 precedent:
 * "do not infer... do not reinterpret a classification"). A uniform policy default is used
 * instead, exactly as Increment 5 handled Evidence's missing weight/reliability. */
const DEFAULT_PRIORITY = "MEDIUM";
const DEFAULT_CONFIDENCE = 0.5;
const DEFAULT_IMPACT_MAGNITUDE = 0.5;
const DEFAULT_IMPACT_TIMEFRAME = "unspecified";

/** `ImpactAssessment.area` is not a numeric guess -- it is a low-risk, mechanical
 * per-type category label drawn directly from each legacy type's own, already-known
 * real-world subject matter (data trust, data validation, coverage, governance), not an
 * invented urgency ranking. Unrecognized types fall back to a generic label. */
const IMPACT_AREA_BY_TYPE: Record<string, string> = {
  DATA_TRUST_TEXT: "data-quality",
  GLOBAL_RULE: "governance",
  LOW_TRUST: "data-quality",
  COPERNICUS_VALIDATION: "data-quality",
  ROLLOUT_OPPORTUNITY: "coverage",
};
const DEFAULT_IMPACT_AREA = "operational";

function issue(
  code: RecommendationAdaptationIssueCode,
  field: string,
  severity: RecommendationAdaptationIssue["severity"],
  message: string,
  canContinue: boolean,
): RecommendationAdaptationIssue {
  return { code, field, severity, message, canContinue };
}

/**
 * A pure type-guard narrowing a plain `readonly T[]` to the canonical non-empty tuple
 * shape (`Recommendation.affectedEntities`'s own type). Used instead of an `as unknown as`
 * cast: the runtime check here (`length > 0`) is the exact same fact
 * `adaptLegacyRecommendation` already establishes via `affectedEntitiesInput.length === 0`
 * and its per-item `validateEntityReferenceShape` loop before this guard is ever consulted
 * -- this function only lets TypeScript itself prove what is already runtime-guaranteed,
 * rather than asserting it past the type system.
 */
function isNonEmptyReadonlyArray<T>(values: readonly T[]): values is readonly [T, ...T[]] {
  return values.length > 0;
}

/**
 * Adapts one legacy recommendation item into a canonical `Recommendation` record,
 * deterministically and without I/O. Never throws for malformed legacy data or context —
 * every "bad data" path returns `success: false` with structured `issues`. Never mutates
 * `item` or `context`, or any `EntityReference` within `context.affectedEntities`.
 */
export function adaptLegacyRecommendation(
  item: LegacyRecommendationItem,
  context: RecommendationAdapterContext,
): RecommendationAdaptationResult {
  const issues: RecommendationAdaptationIssue[] = [];

  // A non-finite legacy priority (NaN/Infinity/-Infinity, or any other non-number value a
  // caller might pass despite the `number | null` type) is never preserved as-is: leaving
  // it in place would let `JSON.stringify` later silently coerce it to `null` with no
  // disclosure at all (JSON has no representation for NaN/Infinity). Instead, this adapter
  // makes that same "we don't have a usable value" outcome explicit and disclosed -- both
  // `sourceReference.rawPriority` and `metadata.legacyPriority` become a deliberate `null`,
  // backed by a structured, non-blocking issue explaining why. A finite number, or the
  // legitimate `null` `DATA_TRUST_TEXT` already uses, passes through unchanged.
  const rawLegacyPriority = item.priority;
  const legacyPriorityIsNonFinite = rawLegacyPriority !== null && !Number.isFinite(rawLegacyPriority);
  if (legacyPriorityIsNonFinite) {
    issues.push(
      issue(
        "invalid_legacy_priority",
        "priority",
        "moderate",
        "Legacy priority is not a finite number (NaN or Infinity); it is not preserved and is recorded as null instead.",
        true,
      ),
    );
  }
  const safeLegacyPriority = legacyPriorityIsNonFinite ? null : rawLegacyPriority;

  const sourceReference: RecommendationSourceReference = {
    rawType: item.type,
    rawText: item.text,
    rawPriority: safeLegacyPriority,
    rawEvidenceContext: item.evidenceContext,
  };

  const reason = (item.text ?? "").trim();
  if (!reason) {
    issues.push(issue("missing_reason", "text", "significant", "Legacy recommendation text is missing or empty.", false));
  }

  const idSeed = (context.idSeed ?? "").trim();
  if (!idSeed) {
    issues.push(issue("missing_id_seed", "idSeed", "significant", "No id seed was supplied to derive a stable RecommendationId.", false));
  }

  const affectedEntitiesInput = context.affectedEntities ?? [];
  if (affectedEntitiesInput.length === 0) {
    issues.push(issue("missing_affected_entities", "affectedEntities", "significant", "No affected entities were supplied; a Recommendation must concern at least one entity.", false));
  }
  let allEntitiesValid = affectedEntitiesInput.length > 0;
  for (let index = 0; index < affectedEntitiesInput.length; index += 1) {
    const result = validateEntityReferenceShape(affectedEntitiesInput[index]);
    if (!result.valid) {
      allEntitiesValid = false;
      issues.push(issue("invalid_affected_entity", `affectedEntities[${index}]`, "significant", "A supplied entity reference is not a valid EntityReference.", false));
    }
  }

  const timestampRaw = (context.timestamp ?? "").trim();
  let timestamp: string | null = null;
  if (!timestampRaw) {
    issues.push(issue("missing_evaluated_at", "timestamp", "significant", "No timestamp was supplied; neither legacy recommendation source carries one of its own.", false));
  } else if (Number.isNaN(Date.parse(timestampRaw))) {
    issues.push(issue("invalid_timestamp", "timestamp", "significant", "The supplied timestamp is not a valid date.", false));
  } else {
    timestamp = timestampRaw;
  }

  const recommendationType = item.type;
  const isKnownType = (LEGACY_RECOMMENDATION_TYPES as readonly string[]).includes(recommendationType);
  if (!isKnownType) {
    issues.push(issue("unrecognized_recommendation_type", "type", "moderate", "Legacy recommendation type does not match any of the five known producer types.", true));
  }

  // Every recommendation gets exactly one policy-default disclosure -- neither legacy
  // producer carries a genuine priority/confidence/impact signal, unlike Evidence's
  // Copernicus/non-Copernicus split, there is no more-precise alternative disclosure here.
  issues.push(
    issue(
      "policy_default_values_applied",
      "priority,confidence,impact",
      "informational",
      "Neither legacy recommendation source carries a priority, confidence, or impact signal of its own; priority=\"MEDIUM\", confidence=0.5, and impact.magnitude=0.5 are adapter policy defaults, not measured from the legacy source.",
      true,
    ),
  );

  if (!reason || !idSeed || !allEntitiesValid || timestamp === null) {
    return {
      success: false,
      recommendation: null,
      issues,
      sourceReference,
      unmappedFields: RECOMMENDATION_ADAPTER_UNMAPPED_FIELDS,
    };
  }

  const isoTimestamp = toIsoDateTime(timestamp);
  const recommendationId: RecommendationId = toIdentifier<"Recommendation">(`recommendation:${idSeed}:${recommendationType}`);
  const mappedEntities = affectedEntitiesInput.map((entity) => ({ kind: entity.kind, id: entity.id }));
  if (!isNonEmptyReadonlyArray(mappedEntities)) {
    // Unreachable: `allEntitiesValid` (checked above, before the early return this line
    // follows) already guarantees `affectedEntitiesInput.length > 0`, and `.map()` always
    // preserves array length. This branch exists only so TypeScript can prove
    // non-emptiness statically, with no cast -- not because it can actually fire.
    return {
      success: false,
      recommendation: null,
      issues,
      sourceReference,
      unmappedFields: RECOMMENDATION_ADAPTER_UNMAPPED_FIELDS,
    };
  }
  const affectedEntities: readonly [EntityReference, ...EntityReference[]] = mappedEntities;
  const impactArea = IMPACT_AREA_BY_TYPE[recommendationType] ?? DEFAULT_IMPACT_AREA;

  const limitations: Limitation[] = [
    {
      description:
        "priority, confidence, and impact are adapter policy defaults -- the legacy recommendation source (services/data-trust-engine.ts's free text, or sentinel-core/recommendation-engine.ts's incidental numeric priority) carries no equivalent structured urgency, confidence, or impact signal of its own.",
      severity: "informational",
    },
    {
      description:
        "recommendedActions is empty -- the legacy source provides a single free-text recommendation, not a discrete, ordered action sequence.",
      severity: "informational",
    },
  ];

  const recommendation: Recommendation = {
    kind: "Recommendation",
    id: recommendationId,
    createdAt: isoTimestamp,
    updatedAt: isoTimestamp,
    version: 1,
    metadata: {
      legacyType: recommendationType,
      legacyPriority: safeLegacyPriority,
      policyDefaultsApplied: true,
      prioritySource: "adapter_policy_default",
      confidenceSource: "adapter_policy_default",
      impactSource: "adapter_policy_default",
    },
    reason,
    priority: DEFAULT_PRIORITY,
    confidence: DEFAULT_CONFIDENCE as Recommendation["confidence"],
    impact: {
      magnitude: DEFAULT_IMPACT_MAGNITUDE as Recommendation["impact"]["magnitude"],
      area: impactArea,
      timeframe: DEFAULT_IMPACT_TIMEFRAME,
    },
    affectedEntities,
    recommendedActions: [],
    evidence: [],
    limitations,
  };

  const structural = validateRecommendationShape(recommendation);
  if (!structural.valid) {
    for (const structuralIssue of structural.issues) {
      issues.push(issue("invalid_canonical_shape", structuralIssue.path, "significant", structuralIssue.message, false));
    }
    return {
      success: false,
      recommendation: null,
      issues,
      sourceReference,
      unmappedFields: RECOMMENDATION_ADAPTER_UNMAPPED_FIELDS,
    };
  }

  return {
    success: true,
    recommendation,
    issues,
    sourceReference,
    unmappedFields: RECOMMENDATION_ADAPTER_UNMAPPED_FIELDS,
  };
}

/** Thin convenience wrapper over `adaptLegacyRecommendation` for a batch of legacy items
 * sharing one `RecommendationAdapterContext` (e.g. `sentinel-core`'s `getRecommendations()`
 * result, up to 60 items). Not a second translation path -- every item is still adapted
 * independently, in order, by `adaptLegacyRecommendation`. */
export function adaptLegacyRecommendationList(
  items: readonly LegacyRecommendationItem[],
  context: RecommendationAdapterContext,
): readonly RecommendationAdaptationResult[] {
  return items.map((item) => adaptLegacyRecommendation(item, context));
}
