import type { Score, EntityReference, Limitation } from "@/services/intelligence";
import type { ScoreId } from "@/services/intelligence/types/identifiers";
import {
  toIdentifier,
  toIsoDateTime,
  validateEntityReferenceShape,
  validateScoreShape,
} from "@/services/intelligence";

/**
 * Genesis Phase 2 — Increment 4 (Data Trust Score Adapter).
 *
 * Pure, dependency-free translation from the legacy Data Trust result
 * (`services/data-trust-engine.ts`'s `dataTrustForSite()`) into a canonical
 * `Score` (`services/intelligence/scoring/score.ts`), per
 * `docs/genesis-phase-2/08_ADAPTER_STRATEGY.md`'s adapter #2.
 *
 * SCOPE, RESTATED (see `docs/genesis-phase-2/20_INCREMENT_4_DATA_TRUST_SCORE_ADAPTER.md`
 * for the full record): `08_ADAPTER_STRATEGY.md` describes adapter #2 as having two
 * halves — "a thin DB-touching outer layer calling `dataTrustForSite(db, id,
 * persist=false)` ... plus a pure inner translator." This module is **only the pure
 * inner translator**. It never opens a database, never calls `dataTrustForSite`, and
 * never executes `services/data-trust-engine.ts` in any way — building the thin
 * DB-touching outer layer is explicitly out of this increment's scope (this mission's
 * own stop condition 19 forbids it) and is deferred to a later, separately-chartered
 * increment that actually wires an adapter into a route or the Orchestrator.
 *
 * This module does NOT change `services/data-trust-engine.ts`'s formula, weights, or
 * behavior in any way, does not persist anything, and does not make the canonical
 * `"data-trust"` engine "active" — it remains `status: "planned"`
 * (`services/intelligence-runtime/canonical-engine-manifests.ts`) after this increment,
 * exactly as before.
 */

/**
 * The narrowest truthful structural shape of `dataTrustForSite()`'s return value that
 * this adapter needs. Hand-declared (no reusable named type exists for this legacy
 * result anywhere in the repository, unlike Increment 3's `SiteRow`), deliberately
 * narrower than the real return value: the real object also carries `site` (a full
 * `SiteRow`, already handled by Increment 3's own adapter — composing that adapter's
 * entire input contract into this one is exactly what this increment's Step 9 warns
 * against) and `satellite` (a nested `satelliteValidationForSite()` object, already
 * summarized by `satelliteConfidence` below). Both are intentionally excluded from
 * this type — a caller may still pass the full real object; TypeScript's structural
 * typing accepts it, this adapter simply never reads those two fields.
 *
 * This is a structural compatibility boundary, not a new canonical model — every field
 * here is copied verbatim from `services/data-trust-engine.ts`'s and
 * `services/confidence-engine.ts`'s actual, evidenced return shapes, not invented.
 */
export interface LegacyDataTrustResult {
  readonly trustScore: number;
  readonly trustLevel: string;
  readonly trustBadge: string;
  readonly recommendation: string;
  readonly duplicateSuggestionPenalty: number;
  readonly activeAlertPenalty: number;
  readonly coordinateConfidence: number;
  readonly addressConfidence: number;
  readonly municipalityConfidence: number;
  readonly operatorConfidence: number;
  readonly technologyConfidence: number;
  readonly satelliteConfidence: number;
  readonly cadastralConfidence: number;
  readonly operationalConfidence: number;
  readonly overallConfidence: number;
}

/**
 * Caller-supplied context this adapter cannot derive on its own. `entityReference`
 * must be the `EntityReference<"Site">` Increment 3's Site Entity Adapter already
 * produced for the same site (`toSiteEntityReference(adaptLegacySiteRow(row).site)`)
 * — this adapter never derives Site identity itself and never accepts a telecom site
 * code as identity (Step 9's explicit rule). `calculatedAt` must be an ISO-8601
 * string supplied by the caller: `services/data-trust-engine.ts`'s
 * `dataTrustForSite()` returns no timestamp of its own (a real, confirmed gap, not an
 * oversight of this adapter), and this module must not call `Date.now()` internally
 * — doing so would make identical input produce different output on different calls,
 * violating the determinism this increment requires. `contextId` is optional
 * bookkeeping (no `IntelligenceOrchestrator` exists yet to issue a real
 * `CalculationContext` id, per `02_CANONICAL_DOMAIN_MODEL.md`'s "Calculation Context"
 * section, which explicitly assigns that ownership to a future Orchestrator, not an
 * individual adapter) and defaults to a static placeholder when omitted.
 */
export interface DataTrustAdapterContext {
  readonly entityReference: EntityReference<"Site">;
  readonly calculatedAt: string;
  readonly contextId?: string;
}

export type DataTrustAdaptationIssueCode =
  | "missing_score"
  | "non_finite_score"
  | "score_out_of_range"
  | "missing_entity_reference"
  | "invalid_entity_reference"
  | "missing_evaluated_at"
  | "invalid_timestamp"
  | "invalid_component_value"
  | "unmapped_classification"
  | "invalid_canonical_shape";

export interface DataTrustAdaptationIssue {
  readonly code: DataTrustAdaptationIssueCode;
  readonly field: string;
  readonly severity: "informational" | "moderate" | "significant";
  readonly message: string;
  readonly canContinue: boolean;
}

/** A narrow set of raw legacy values preserved for traceability — the exact
 * `trustScore`/`trustBadge`/`trustLevel` this Score was adapted from, before any
 * scale conversion. */
export interface DataTrustSourceReference {
  readonly rawTrustScore: number;
  readonly rawTrustBadge: string;
  readonly rawTrustLevel: string;
}

export interface DataTrustAdaptationResult {
  readonly success: boolean;
  /** The canonical `Score`, present only when `success` is `true`. Its presence
   * means "adaptation completed and the result is structurally valid" — it does
   * **not** mean the Data Trust score itself is trustworthy, nor that the
   * `"data-trust"` engine is operational (see the module header note). */
  readonly score: Score | null;
  readonly issues: readonly DataTrustAdaptationIssue[];
  readonly sourceReference: DataTrustSourceReference;
  /** `LegacyDataTrustResult`'s real, wider counterpart's fields with no
   * representation in this adapter's input/output at all — `"site"` (Increment 3's
   * own adapter handles it) and `"satellite"` (already summarized by
   * `satelliteConfidence`). A fixed, documented list, not a per-call computation. */
  readonly unmappedFields: readonly string[];
}

export const DATA_TRUST_ADAPTER_UNMAPPED_FIELDS: readonly string[] = ["site", "satellite"];

/** This adapter's own version identifiers — see the module header and
 * `docs/genesis-phase-2/20_INCREMENT_4_DATA_TRUST_SCORE_ADAPTER.md` Section 16 for why
 * these mirror Increment 2's already-registered `"data-trust"` manifest declaration
 * (`services/intelligence-runtime/canonical-engine-manifests.ts`) rather than reading
 * it programmatically (avoiding a new cross-directory coupling between the adapter and
 * runtime-registry layers) or inventing a third, independent version number. */
const DATA_TRUST_ENGINE_VERSION = "0.1.0";
const DATA_TRUST_CONTRACT_VERSION = "1.0.0";

/** Confidence sub-score weights exactly as they appear in
 * `services/confidence-engine.ts`'s `overallConfidence` calculation (line 39, as of
 * this increment). Transcribed, not read from config — `confidence-engine.ts` has no
 * config-driven weights today (Principle 2 names externalizing them as a future,
 * separate refactor). If that refactor changes these constants, this adapter's driver
 * weights must be updated to match by hand; they are not derived dynamically. */
const CONFIDENCE_COMPONENT_WEIGHTS = {
  coordinateConfidence: 0.2,
  addressConfidence: 0.12,
  municipalityConfidence: 0.12,
  operatorConfidence: 0.1,
  technologyConfidence: 0.1,
  satelliteConfidence: 0.16,
  cadastralConfidence: 0.1,
  operationalConfidence: 0.1,
} as const;

type ConfidenceComponentName = keyof typeof CONFIDENCE_COMPONENT_WEIGHTS;

const CANONICAL_SCORE_CLASSIFICATION_VALUES = ["LOW", "MODERATE", "HIGH", "CRITICAL"];

function issue(
  code: DataTrustAdaptationIssueCode,
  field: string,
  severity: DataTrustAdaptationIssue["severity"],
  message: string,
  canContinue: boolean,
): DataTrustAdaptationIssue {
  return { code, field, severity, message, canContinue };
}

interface DriverLike {
  readonly factor: string;
  readonly weight: number;
  readonly contribution: number;
  readonly explanation: string;
}

/**
 * Adapts one legacy Data Trust result into a canonical `Score`, deterministically and
 * without I/O. Never throws for malformed legacy data or context — every "bad data"
 * path returns `success: false` with structured `issues`. Never mutates `input` or
 * `context.entityReference`, and never returns a reference into either.
 */
export function adaptLegacyDataTrustResult(
  input: LegacyDataTrustResult,
  context: DataTrustAdapterContext,
): DataTrustAdaptationResult {
  const issues: DataTrustAdaptationIssue[] = [];

  const sourceReference: DataTrustSourceReference = {
    rawTrustScore: input.trustScore,
    rawTrustBadge: input.trustBadge,
    rawTrustLevel: input.trustLevel,
  };

  // --- Entity reference -----------------------------------------------------
  const entityReferenceResult = validateEntityReferenceShape(context.entityReference);
  if (!context.entityReference) {
    issues.push(issue("missing_entity_reference", "entityReference", "significant", "No canonical Site reference was supplied.", false));
  } else if (!entityReferenceResult.valid || context.entityReference.kind !== "Site") {
    issues.push(issue("invalid_entity_reference", "entityReference", "significant", "The supplied entity reference is not a valid EntityReference<\"Site\">.", false));
  }

  // --- Timestamp -------------------------------------------------------------
  const calculatedAtRaw = (context.calculatedAt ?? "").trim();
  let calculatedAt: string | null = null;
  if (!calculatedAtRaw) {
    issues.push(issue("missing_evaluated_at", "calculatedAt", "significant", "No calculation timestamp was supplied; the legacy Data Trust result carries none of its own.", false));
  } else if (Number.isNaN(Date.parse(calculatedAtRaw))) {
    issues.push(issue("invalid_timestamp", "calculatedAt", "significant", "The supplied calculation timestamp is not a valid date.", false));
  } else {
    calculatedAt = calculatedAtRaw;
  }

  // --- Score value -------------------------------------------------------------
  let scoreValue: number | null = null;
  if (typeof input.trustScore !== "number") {
    issues.push(issue("missing_score", "trustScore", "significant", "Legacy trustScore is missing or not a number.", false));
  } else if (!Number.isFinite(input.trustScore)) {
    issues.push(issue("non_finite_score", "trustScore", "significant", "Legacy trustScore is NaN or Infinity.", false));
  } else {
    if (input.trustScore < 0 || input.trustScore > 100) {
      issues.push(issue("score_out_of_range", "trustScore", "moderate", "Legacy trustScore falls outside the expected [0, 100] range.", true));
    }
    // Mechanical scale conversion only (ADR-003, 15_ARCHITECTURE_DECISIONS.md:
    // canonical Score.value uses a 0-1 scale, legacy = 0-100, canonical = legacy / 100).
    // No clamping, no rounding beyond what the legacy formula itself already applied.
    scoreValue = input.trustScore / 100;
  }

  if (scoreValue === null || calculatedAt === null || !context.entityReference || context.entityReference.kind !== "Site" || !entityReferenceResult.valid) {
    return {
      success: false,
      score: null,
      issues,
      sourceReference,
      unmappedFields: DATA_TRUST_ADAPTER_UNMAPPED_FIELDS,
    };
  }

  // --- Drivers: eight confidence sub-scores + two penalties, per 08_ADAPTER_STRATEGY.md
  const drivers: DriverLike[] = [];
  const componentEntries: Array<[ConfidenceComponentName, number]> = [
    ["coordinateConfidence", input.coordinateConfidence],
    ["addressConfidence", input.addressConfidence],
    ["municipalityConfidence", input.municipalityConfidence],
    ["operatorConfidence", input.operatorConfidence],
    ["technologyConfidence", input.technologyConfidence],
    ["satelliteConfidence", input.satelliteConfidence],
    ["cadastralConfidence", input.cadastralConfidence],
    ["operationalConfidence", input.operationalConfidence],
  ];
  for (const [name, rawValue] of componentEntries) {
    if (typeof rawValue !== "number" || !Number.isFinite(rawValue)) {
      issues.push(issue("invalid_component_value", name, "moderate", `Legacy ${name} is not a finite number; omitted from drivers.`, true));
      continue;
    }
    const weight = CONFIDENCE_COMPONENT_WEIGHTS[name];
    drivers.push({
      factor: name,
      weight,
      contribution: weight * (rawValue / 100),
      explanation: `Weighted ${Math.round(weight * 100)}% into the legacy Confidence Engine's overallConfidence sub-score (services/confidence-engine.ts).`,
    });
  }
  const penaltyEntries: Array<[string, number, string]> = [
    ["duplicateSuggestionPenalty", input.duplicateSuggestionPenalty, "Subtracted directly from the legacy Trust Score as a duplicate-suggestion penalty (services/data-trust-engine.ts)."],
    ["activeAlertPenalty", input.activeAlertPenalty, "Subtracted directly from the legacy Trust Score as an active-alert penalty (services/data-trust-engine.ts)."],
  ];
  for (const [name, rawValue, explanation] of penaltyEntries) {
    if (typeof rawValue !== "number" || !Number.isFinite(rawValue)) {
      issues.push(issue("invalid_component_value", name, "moderate", `Legacy ${name} is not a finite number; omitted from drivers.`, true));
      continue;
    }
    drivers.push({ factor: name, weight: 1, contribution: -(rawValue / 100), explanation });
  }

  // --- Classification (legacy trustBadge, passed through verbatim) -----------
  const classification = input.trustBadge;
  if (!CANONICAL_SCORE_CLASSIFICATION_VALUES.includes(classification)) {
    issues.push(
      issue(
        "unmapped_classification",
        "trustBadge",
        "informational",
        "Legacy trustBadge does not match a canonical LOW/MODERATE/HIGH/CRITICAL classification; the raw legacy label is used as-is since ScoreClassification is open-ended by contract design.",
        true,
      ),
    );
  }

  // --- Confidence (proxy: legacy overallConfidence, the closest evidenced signal) ---
  let confidenceValue = 0;
  if (typeof input.overallConfidence === "number" && Number.isFinite(input.overallConfidence)) {
    confidenceValue = Math.max(0, Math.min(1, input.overallConfidence / 100));
  }

  const limitations: Limitation[] = [
    {
      description:
        "This Score's confidence value reuses the legacy overallConfidence sub-score (services/confidence-engine.ts) as a proxy for confidence-in-this-score; the legacy Data Trust engine computes no distinct meta-confidence signal of its own.",
      severity: "informational",
    },
    {
      description:
        "engineVersion/contractVersion mirror Increment 2's registered manifest declaration for the \"data-trust\" EngineId (services/intelligence-runtime/canonical-engine-manifests.ts), not an internal version the legacy formula itself asserts -- services/data-trust-engine.ts has no version constant.",
      severity: "informational",
    },
    {
      description:
        "classification carries the legacy trustBadge label verbatim (e.g. \"Platinum\"/\"Gold\"/\"Silver\"/\"Bronze\"/\"Critical\"), which does not match the four canonical classification levels -- preserved as-is since ScoreClassification is open-ended by contract design.",
      severity: "informational",
    },
  ];

  const scoreId: ScoreId = toIdentifier<"Score">(`data-trust:${context.entityReference.id}`);
  const isoCalculatedAt = toIsoDateTime(calculatedAt);

  const score: Score = {
    kind: "Score",
    id: scoreId,
    createdAt: isoCalculatedAt,
    updatedAt: isoCalculatedAt,
    version: 1,
    metadata: {
      legacyTrustLevel: input.trustLevel,
      legacyRecommendation: input.recommendation,
    },
    entity: { kind: context.entityReference.kind, id: context.entityReference.id },
    type: "data-trust",
    value: scoreValue,
    classification,
    confidence: confidenceValue as Score["confidence"],
    engineVersion: DATA_TRUST_ENGINE_VERSION as Score["engineVersion"],
    contractVersion: DATA_TRUST_CONTRACT_VERSION as Score["contractVersion"],
    drivers,
    evidence: [],
    limitations,
    calculatedAt: isoCalculatedAt,
    executionMetadata: {
      engineId: "data-trust",
      contextId: context.contextId?.trim() || "no-orchestrator-adapter-preview",
      executedAt: isoCalculatedAt,
      durationMs: 0,
      notes: [
        "Produced by services/intelligence-adapters/data-trust-score-adapter.ts's pure translator, not a live engine execution.",
      ],
    },
  };

  const structural = validateScoreShape(score);
  if (!structural.valid) {
    for (const structuralIssue of structural.issues) {
      issues.push(issue("invalid_canonical_shape", structuralIssue.path, "significant", structuralIssue.message, false));
    }
    return {
      success: false,
      score: null,
      issues,
      sourceReference,
      unmappedFields: DATA_TRUST_ADAPTER_UNMAPPED_FIELDS,
    };
  }

  return {
    success: true,
    score,
    issues,
    sourceReference,
    unmappedFields: DATA_TRUST_ADAPTER_UNMAPPED_FIELDS,
  };
}
