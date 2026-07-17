import type { Evidence } from "@/services/intelligence";
import type { EvidenceId, SnapshotId, DataSourceId } from "@/services/intelligence/types/identifiers";
import { toIdentifier, toIsoDateTime, validateEvidenceShape } from "@/services/intelligence";
import { copernicusTruthMetadata } from "@/services/copernicus-truth";

/**
 * Genesis Phase 2 — Increment 5 (Evidence Adapter).
 *
 * Pure, dependency-free translation from `services/evidence-center-engine.ts`'s legacy
 * evidence array into canonical `Evidence` records
 * (`services/intelligence/evidence/evidence.ts`), per
 * `docs/genesis-phase-2/08_ADAPTER_STRATEGY.md`'s adapter #3.
 *
 * `services/copernicus-truth.ts` is imported deliberately, not as an "engine" (it has no
 * formula, no computation, no I/O — its own header describes itself as "deliberately
 * dependency-free... available for any future runtime assertion"), and its reuse here is
 * a **mandatory** acceptance criterion of this increment
 * (`14_IMPLEMENTATION_ROADMAP.md` Increment 5: "every Copernicus-sourced Evidence item
 * carries `reliability` reflecting simulated status and a `Limitation` disclosing it —
 * verified by a dedicated test asserting `isTruthfulCopernicusResponse`-equivalent
 * behavior survives the adapter translation (reusing `services/copernicus-truth.ts`'s
 * own existing helper where possible)").
 *
 * This module does not change `services/evidence-center-engine.ts`'s behavior, does not
 * call it, does not persist anything, and does not execute any engine.
 */

/**
 * The exact five evidence-type literals `evidenceCenterForSite()`
 * (`services/evidence-center-engine.ts`) hardcodes in its `evidences` array literal, as
 * confirmed by direct reading. Not a guess — these five strings, and no others, appear in
 * that function's source today.
 */
export const LEGACY_EVIDENCE_TYPES = ["CADASTRO", "COORDENADAS", "COPERNICUS", "QUALIDADE", "OBSERVACOES"] as const;
export type LegacyEvidenceType = (typeof LEGACY_EVIDENCE_TYPES)[number];

/**
 * The narrowest truthful structural shape of one entry in `evidenceCenterForSite()`'s
 * `evidences` array. Hand-declared — no reusable named type exists for it anywhere in the
 * repository (unlike Increment 3's `SiteRow`). `type` is left as `string`, not narrowed to
 * `LegacyEvidenceType`, so a future sixth legacy evidence type does not become a compile
 * error at this boundary — this adapter handles an unrecognized type with a documented,
 * non-blocking fallback (see the `unrecognized_evidence_type` issue code below).
 */
export interface LegacyEvidenceItem {
  readonly type: string;
  readonly source: string;
  readonly status: string;
  readonly summary: string;
}

/**
 * Caller-supplied context this adapter cannot derive on its own — mirroring Increment 4's
 * `DataTrustAdapterContext` pattern for exactly the same reason: none of these values exist
 * anywhere in a `LegacyEvidenceItem`.
 *
 * - `idSeed`: typically the subject's `EntityReference` id (e.g. the Site this evidence
 *   batch is about) — `Evidence` itself carries no entity/site link (confirmed: the
 *   canonical `Evidence` interface has no such field, evidence is only ever *cited* by a
 *   `Score`/`Recommendation` via `EvidenceId`), but a deterministic, collision-safe id still
 *   needs *some* per-subject seed, or every site's "CADASTRO" evidence would collapse onto
 *   the same `EvidenceId`.
 * - `snapshot`/`source`/`checksum`/`timestamp`: `DataProvenance`'s required fields.
 *   `02_CANONICAL_DOMAIN_MODEL.md`'s "Dataset Snapshot" section is explicit that **no
 *   snapshot mechanism exists in the legacy system today** ("a genuine gap, not a rename
 *   target") and names a future "minimal Snapshot Provider" as the eventual fix — until
 *   that exists, the caller supplies a snapshot identifier explicitly, exactly as that
 *   document anticipates.
 * - `version`: optional: defaults to this adapter's own static contract version if omitted.
 */
export interface EvidenceAdapterContext {
  readonly idSeed: string;
  readonly snapshot: string;
  readonly source: string;
  readonly checksum: string;
  readonly timestamp: string;
  readonly version?: string;
}

export type EvidenceAdaptationIssueCode =
  | "missing_source"
  | "missing_description"
  | "missing_id_seed"
  | "missing_snapshot"
  | "missing_provenance_source"
  | "missing_checksum"
  | "missing_evaluated_at"
  | "invalid_timestamp"
  | "unrecognized_evidence_type"
  | "copernicus_evidence_simulated"
  | "policy_default_values_applied"
  | "invalid_canonical_shape";

export interface EvidenceAdaptationIssue {
  readonly code: EvidenceAdaptationIssueCode;
  readonly field: string;
  readonly severity: "informational" | "moderate" | "significant";
  readonly message: string;
  readonly canContinue: boolean;
}

/** A narrow set of raw legacy values preserved for traceability. */
export interface EvidenceSourceReference {
  readonly rawType: string;
  readonly rawSource: string;
  readonly rawStatus: string;
  readonly rawSummary: string;
}

export interface EvidenceAdaptationResult {
  readonly success: boolean;
  /** The canonical `Evidence`, present only when `success` is `true`. Its presence
   * means "adaptation completed and the result is structurally valid" — it does
   * **not** mean the evidence is complete, reliable, sufficient, or factually true.
   * In particular, `weight`/`reliability` may be adapter policy defaults rather
   * than measured legacy signals — see `metadata.policyDefaultsApplied` and the
   * `policy_default_values_applied`/`copernicus_evidence_simulated` issue codes. */
  readonly evidence: Evidence | null;
  readonly issues: readonly EvidenceAdaptationIssue[];
  readonly sourceReference: EvidenceSourceReference;
  /** `LegacyEvidenceItem` has no field with no canonical home — every field maps
   * somewhere (`source`, `description`, and `status`/`type` via `metadata`/`origin`) — so
   * this is always empty for this adapter. Kept for interface consistency with the Site
   * and Data Trust adapters, and to make that completeness explicit rather than silent. */
  readonly unmappedFields: readonly string[];
}

export const EVIDENCE_ADAPTER_UNMAPPED_FIELDS: readonly string[] = [];

/** This adapter's own contract version, used only when `context.version` is omitted.
 * Not read from any manifest (no `EvidenceManifest` is declared by this increment). */
const EVIDENCE_ADAPTER_DEFAULT_VERSION = "0.1.0";

/** `DataProvenance.pipeline` — the producing function's name, constant across every
 * evidence type (all five come from the same `evidenceCenterForSite()` call). */
const EVIDENCE_CENTER_PIPELINE = "evidence-center";

/** No legacy evidence item carries a numeric reliability/weight signal of its own — every
 * field below is a documented policy default, not a measurement. This is disclosed at
 * runtime, not just in comments: every non-Copernicus item carries
 * `metadata.policyDefaultsApplied`/`weightSource`/`reliabilitySource` and a
 * `policy_default_values_applied` issue. `COPERNICUS` is the sole, mandatory exception
 * to the *value* (not the disclosure principle): reliability is forced low to reflect
 * `COPERNICUS_IS_REAL_SATELLITE_EVIDENCE === false` (`services/copernicus-truth.ts`),
 * per this increment's mandatory acceptance criterion, and is disclosed via its own,
 * more precise `simulatedDataDisclosure`/`copernicus_evidence_simulated` pair instead of
 * the generic policy-default pair (never both, to avoid a redundant issue). */
const DEFAULT_RELIABILITY = 0.5;
const COPERNICUS_RELIABILITY = 0.1;
const DEFAULT_WEIGHT = 1;

function issue(
  code: EvidenceAdaptationIssueCode,
  field: string,
  severity: EvidenceAdaptationIssue["severity"],
  message: string,
  canContinue: boolean,
): EvidenceAdaptationIssue {
  return { code, field, severity, message, canContinue };
}

/**
 * Adapts one legacy evidence-center item into a canonical `Evidence` record,
 * deterministically and without I/O. Never throws for malformed legacy data or context —
 * every "bad data" path returns `success: false` with structured `issues`. Never mutates
 * `item` or `context`.
 */
export function adaptLegacyEvidence(item: LegacyEvidenceItem, context: EvidenceAdapterContext): EvidenceAdaptationResult {
  const issues: EvidenceAdaptationIssue[] = [];

  const sourceReference: EvidenceSourceReference = {
    rawType: item.type,
    rawSource: item.source,
    rawStatus: item.status,
    rawSummary: item.summary,
  };

  const source = (item.source ?? "").trim();
  if (!source) {
    issues.push(issue("missing_source", "source", "significant", "Legacy evidence source is missing or empty.", false));
  }

  const description = (item.summary ?? "").trim();
  if (!description) {
    issues.push(issue("missing_description", "summary", "significant", "Legacy evidence summary is missing or empty.", false));
  }

  const idSeed = (context.idSeed ?? "").trim();
  if (!idSeed) {
    issues.push(issue("missing_id_seed", "idSeed", "significant", "No id seed was supplied to derive a stable EvidenceId.", false));
  }

  const snapshotRaw = (context.snapshot ?? "").trim();
  if (!snapshotRaw) {
    issues.push(issue("missing_snapshot", "snapshot", "significant", "No snapshot identifier was supplied; the legacy system has no snapshot mechanism of its own.", false));
  }

  const provenanceSourceRaw = (context.source ?? "").trim();
  if (!provenanceSourceRaw) {
    issues.push(issue("missing_provenance_source", "source", "significant", "No provenance data-source identifier was supplied.", false));
  }

  const checksumRaw = (context.checksum ?? "").trim();
  if (!checksumRaw) {
    issues.push(issue("missing_checksum", "checksum", "significant", "No checksum was supplied.", false));
  }

  const timestampRaw = (context.timestamp ?? "").trim();
  let timestamp: string | null = null;
  if (!timestampRaw) {
    issues.push(issue("missing_evaluated_at", "timestamp", "significant", "No timestamp was supplied; the legacy evidence item carries none of its own.", false));
  } else if (Number.isNaN(Date.parse(timestampRaw))) {
    issues.push(issue("invalid_timestamp", "timestamp", "significant", "The supplied timestamp is not a valid date.", false));
  } else {
    timestamp = timestampRaw;
  }

  const evidenceType = item.type;
  const isKnownType = (LEGACY_EVIDENCE_TYPES as readonly string[]).includes(evidenceType);
  if (!isKnownType) {
    issues.push(issue("unrecognized_evidence_type", "type", "moderate", "Legacy evidence type does not match any of the five known evidence-center types.", true));
  }
  // Every evidence item gets exactly one type-driven disclosure issue -- Copernicus's
  // own, more precise disclosure, or the generic policy-default disclosure below.
  // Never both (would be redundant) and never neither (weight/reliability are always
  // adapter-supplied, never measured from the legacy source -- see Section 11 of
  // docs/genesis-phase-2/21_INCREMENT_5_EVIDENCE_ADAPTER.md).
  const isCopernicus = evidenceType === "COPERNICUS";
  if (isCopernicus) {
    issues.push(
      issue(
        "copernicus_evidence_simulated",
        "type",
        "significant",
        "This evidence's underlying data is simulated (no real Sentinel-1/Copernicus satellite integration exists yet); reliability is capped low regardless of legacy status text.",
        true,
      ),
    );
  } else {
    issues.push(
      issue(
        "policy_default_values_applied",
        "weight,reliability",
        "informational",
        "Legacy evidence carries no weight/reliability signal of its own; weight=1 and reliability=0.5 are adapter policy defaults, not measured from the legacy source.",
        true,
      ),
    );
  }

  if (
    !source ||
    !description ||
    !idSeed ||
    !snapshotRaw ||
    !provenanceSourceRaw ||
    !checksumRaw ||
    timestamp === null
  ) {
    return {
      success: false,
      evidence: null,
      issues,
      sourceReference,
      unmappedFields: EVIDENCE_ADAPTER_UNMAPPED_FIELDS,
    };
  }

  const isoTimestamp = toIsoDateTime(timestamp);
  const snapshot: SnapshotId = toIdentifier<"Snapshot">(snapshotRaw);
  const dataSource: DataSourceId = toIdentifier<"DataSource">(provenanceSourceRaw);
  const version = (context.version?.trim() || EVIDENCE_ADAPTER_DEFAULT_VERSION) as Evidence["origin"]["version"];

  const processingMetadata = isCopernicus ? { ...copernicusTruthMetadata() } : {};

  const evidenceId: EvidenceId = toIdentifier<"Evidence">(`evidence:${idSeed}:${evidenceType}`);

  const evidence: Evidence = {
    kind: "Evidence",
    id: evidenceId,
    createdAt: isoTimestamp,
    updatedAt: isoTimestamp,
    version: 1,
    metadata: {
      legacyType: evidenceType,
      legacyStatus: item.status,
      ...(isCopernicus
        ? { simulatedDataDisclosure: true }
        : {
            policyDefaultsApplied: true,
            weightSource: "adapter_policy_default",
            reliabilitySource: "adapter_policy_default",
          }),
    },
    source,
    description,
    weight: DEFAULT_WEIGHT,
    reliability: (isCopernicus ? COPERNICUS_RELIABILITY : DEFAULT_RELIABILITY) as Evidence["reliability"],
    snapshot,
    origin: {
      origin: source,
      pipeline: EVIDENCE_CENTER_PIPELINE,
      snapshot,
      source: dataSource,
      checksum: checksumRaw,
      timestamp: isoTimestamp,
      version,
      processingMetadata,
    },
    checksum: checksumRaw,
    references: [],
  };

  const structural = validateEvidenceShape(evidence);
  if (!structural.valid) {
    for (const structuralIssue of structural.issues) {
      issues.push(issue("invalid_canonical_shape", structuralIssue.path, "significant", structuralIssue.message, false));
    }
    return {
      success: false,
      evidence: null,
      issues,
      sourceReference,
      unmappedFields: EVIDENCE_ADAPTER_UNMAPPED_FIELDS,
    };
  }

  return {
    success: true,
    evidence,
    issues,
    sourceReference,
    unmappedFields: EVIDENCE_ADAPTER_UNMAPPED_FIELDS,
  };
}

/** Thin convenience wrapper over `adaptLegacyEvidence` for the real shape
 * `evidenceCenterForSite()` actually produces: an array of (today, five) evidence items
 * sharing one `EvidenceAdapterContext`. Not a second translation path — every item is
 * still adapted independently by `adaptLegacyEvidence`. */
export function adaptLegacyEvidenceList(
  items: readonly LegacyEvidenceItem[],
  context: EvidenceAdapterContext,
): readonly EvidenceAdaptationResult[] {
  return items.map((item) => adaptLegacyEvidence(item, context));
}
