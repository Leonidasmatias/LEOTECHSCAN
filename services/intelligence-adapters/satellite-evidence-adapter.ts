import { createHash } from "node:crypto";
import type { Evidence } from "@/services/intelligence";
import type { EvidenceId, SnapshotId, DataSourceId } from "@/services/intelligence/types/identifiers";
import { toIdentifier, toIsoDateTime } from "@/services/intelligence";
import { computeSatelliteEvidenceChecksum } from "./satellite-evidence-checksum";
import type { SatelliteObservation } from "./satellite-observation-model";

/**
 * Genesis Phase 2 — Increment 10 (Satellite Intelligence), Wave 4.
 *
 * Pure, dependency-free translation from one successfully-adapted
 * `SatelliteObservation` (Wave 2's own output) into one canonical `Evidence` record
 * (`services/intelligence/evidence/evidence.ts`), per
 * `docs/genesis-phase-2/29_INCREMENT_10_SATELLITE_INTELLIGENCE_PLAN.md` Section 10.4
 * and `docs/genesis-phase-2/30_INCREMENT_10_SATELLITE_INTELLIGENCE_IMPLEMENTATION_PLAN.md`
 * Section 9.8.
 *
 * This module does not call the legacy Copernicus engine, does not persist anything,
 * does not perform I/O, and does not construct `SatelliteTruthMetadata` -- that
 * remains the exclusive responsibility of the Wave 3 provider adapter / Wave 5
 * orchestrator composition. This module never touches a scene with a missing
 * `sourceSceneId`: Wave 2 (`satellite-observation-adapter.ts`) already excludes those
 * before this adapter is ever reached in the real orchestrator composition (Wave 5);
 * this file assumes a non-null, non-empty `sourceSceneId` on every call, per its own
 * caller contract.
 */

/** Caller-supplied context this adapter cannot derive from `SatelliteObservation`
 * alone -- mirroring `evidence-adapter.ts`'s own `EvidenceAdapterContext` pattern for
 * exactly the same reason: none of these values have a home on `SatelliteObservation`.
 *
 * - `siteId`/`sourceSceneId`: the two raw inputs the frozen `EvidenceId` formula
 *   (`satellite:<providerCode>:<siteId>:<sha256Hex(sourceSceneId.trim())>`) requires
 *   beyond `providerCode` (already present on `observation.provider.providerCode`).
 *   Neither is a field of `SatelliteObservation` itself -- `observationId` embeds
 *   both internally, but parsing that string back apart would be a fragile,
 *   undocumented reliance on Wave 2's own internal formatting, not a stable contract.
 * - `snapshot`: `DataProvenance.snapshot` is mandatory, but Increment 10 introduces no
 *   Snapshot mechanism of its own (no frozen Snapshot Provider is wired to this
 *   capability) -- mirroring `EvidenceAdapterContext.snapshot`'s own identical gap,
 *   the caller supplies a snapshot identifier explicitly. Unlike `sourceSceneId`
 *   (whose non-emptiness is guaranteed upstream by Wave 2's own exclusion, per this
 *   file's own caller contract), nothing guarantees `snapshot` is non-empty -- an
 *   empty or whitespace-only value never throws here; it falls back deterministically
 *   (see `normalizeSnapshotSeed` below), so this field accepts any `string`, including
 *   `""`.
 */
export interface SatelliteEvidenceAdapterContext {
  readonly siteId: number;
  readonly sourceSceneId: string;
  readonly snapshot: string;
}

/** Forced low, mirroring the `COPERNICUS_RELIABILITY = 0.1` precedent
 * (`evidence-adapter.ts`) -- a disclosure/trust rule, not a new scoring algorithm.
 * The underlying data remains simulated regardless of the legacy validation score's
 * own value, so reliability never varies with it. */
const SATELLITE_EVIDENCE_RELIABILITY = 0.1;

const DEFAULT_WEIGHT = 1;

/** Distinct from Evidence Center's own `"evidence-center"` `DataSourceId` -- the two
 * evidence streams are never conflated (frozen plan Section 18). */
const SATELLITE_DATA_SOURCE = "satellite-intelligence";

const SATELLITE_EVIDENCE_PIPELINE = "satellite-intelligence";

const SATELLITE_EVIDENCE_ADAPTER_VERSION = "1.0.0";

/** Prefix for the deterministic snapshot fallback (see `normalizeSnapshotSeed`) --
 * distinguishes a synthesized snapshot seed from a genuine caller-supplied one at a
 * glance, never itself a plausible real snapshot identifier a caller would supply. */
const SNAPSHOT_FALLBACK_PREFIX = "satellite-snapshot:";

/**
 * Normalizes `context.snapshot` into a non-empty seed for `SnapshotId` construction.
 * A non-empty, trimmed `snapshot` is used verbatim. An empty or whitespace-only
 * `snapshot` -- unlike `sourceSceneId`, never guaranteed non-empty by any upstream
 * contract -- falls back to a deterministic value derived only from this same call's
 * own already-computed `evidenceId` (never `Date.now()`, `Math.random()`,
 * `crypto.randomUUID()`, or any external state), so the same
 * `(observation, context)` pair always yields the same snapshot seed, and two
 * different observations/contexts never collide on the fallback. This never widens
 * `context` with a new field and never changes the `EvidenceId` formula itself --
 * `evidenceId` is only ever read here, not recomputed.
 */
function normalizeSnapshotSeed(rawSnapshot: string, evidenceId: EvidenceId): string {
  const trimmed = rawSnapshot.trim();
  return trimmed.length > 0 ? trimmed : `${SNAPSHOT_FALLBACK_PREFIX}${evidenceId}`;
}

/**
 * The exact, collision-safe `EvidenceId` formula (frozen plan Section 10.4/F-4):
 * `satellite:<providerCode>:<siteId>:<sha256Hex(sourceSceneId.trim())>`.
 * `providerCode` is trimmed and lowercased before embedding; `sourceSceneId` is
 * trimmed before hashing, never substituted whole into the id. Deterministic, no
 * timestamp/random component -- proven, by construction, incapable of colliding with
 * Evidence Center's own `evidence:<siteId>:COPERNICUS` format (a different segment
 * count and a 64-character hex segment `COPERNICUS` can never match).
 */
function computeSatelliteEvidenceId(providerCode: string, siteId: number, sourceSceneId: string): EvidenceId {
  const normalizedProviderCode = providerCode.trim().toLowerCase();
  const digest = createHash("sha256").update(sourceSceneId.trim(), "utf8").digest("hex");
  return toIdentifier<"Evidence">(`satellite:${normalizedProviderCode}:${siteId}:${digest}`);
}

/**
 * Adapts one already-successfully-adapted `SatelliteObservation` into one canonical
 * `Evidence` record, deterministically and without I/O. Never throws for any
 * well-formed `observation`/`context` -- including an empty or whitespace-only
 * `context.snapshot`, which falls back deterministically (`normalizeSnapshotSeed`)
 * rather than propagating a validation exception; never mutates either argument.
 */
export function adaptSatelliteObservationToEvidence(
  observation: SatelliteObservation,
  context: SatelliteEvidenceAdapterContext,
): Evidence {
  const isoTimestamp = toIsoDateTime(observation.temporal.retrievedAt);
  const evidenceId = computeSatelliteEvidenceId(observation.provider.providerCode, context.siteId, context.sourceSceneId);
  const snapshot: SnapshotId = toIdentifier<"Snapshot">(normalizeSnapshotSeed(context.snapshot, evidenceId));
  const dataSource: DataSourceId = toIdentifier<"DataSource">(SATELLITE_DATA_SOURCE);
  const checksum = computeSatelliteEvidenceChecksum(observation);
  const source = `${observation.provider.dataset} (${observation.provider.providerCode})`;
  const description = `Satellite ${observation.observationType} observation from ${observation.provider.dataset}, captured ${observation.temporal.captureTime ?? "at an unreported time"}.`;

  const evidence: Evidence = {
    kind: "Evidence",
    id: evidenceId,
    createdAt: isoTimestamp,
    updatedAt: isoTimestamp,
    version: 1,
    metadata: {
      observationId: observation.observationId,
      observationType: observation.observationType,
      providerCode: observation.provider.providerCode,
      dataset: observation.provider.dataset,
      derivationMethod: observation.derivationMethod,
    },
    source,
    description,
    weight: DEFAULT_WEIGHT,
    reliability: SATELLITE_EVIDENCE_RELIABILITY as Evidence["reliability"],
    snapshot,
    origin: {
      origin: source,
      pipeline: SATELLITE_EVIDENCE_PIPELINE,
      snapshot,
      source: dataSource,
      checksum,
      timestamp: isoTimestamp,
      version: SATELLITE_EVIDENCE_ADAPTER_VERSION as Evidence["origin"]["version"],
      processingMetadata: {},
    },
    checksum,
    references: [],
  };

  return evidence;
}
