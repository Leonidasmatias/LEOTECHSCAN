import { createHash } from "node:crypto";
import type { SatelliteObservation } from "./satellite-observation-model";

/**
 * Genesis Phase 2 — Increment 10 (Satellite Intelligence), Wave 4.
 *
 * Pure, dependency-free deterministic content fingerprint for one
 * `SatelliteObservation`, mirroring `services/intelligence-adapters/evidence-checksum.ts`'s
 * fixed-order/unit-separator/versioned-prefix algorithm (Increment 8 precedent), per
 * `docs/genesis-phase-2/30_INCREMENT_10_SATELLITE_INTELLIGENCE_IMPLEMENTATION_PLAN.md`
 * Section 9.7.
 *
 * This is a **content fingerprint, not a cryptographic proof**: it exists so a future
 * reader can detect that an observation's own scene-derived content has drifted since it
 * was recorded — matching `Evidence.checksum`'s own documented purpose
 * ("content-integrity checksum of the evidence payload"). SHA-256 is used here purely
 * for its strong collision resistance as a hash function, not for authentication.
 *
 * Deliberately excludes `evidenceId` -- a derived identifier that references the
 * `Evidence` record this observation feeds, not part of the observation's own scene
 * content, mirroring `evidence-checksum.ts`'s own exclusion of `siteId`/`timestamp`/
 * `snapshot` (contextual/positional values, not the item's own content).
 */

const CHECKSUM_VERSION_PREFIX = "sha256-v1:";

/** ASCII Unit Separator (decimal code point 31, hex 1F) -- separates top-level fields.
 * Built via `String.fromCharCode` so its intent stays visible, matching the accepted
 * `evidence-checksum.ts` precedent. */
const UNIT_SEPARATOR = String.fromCharCode(31);

/** ASCII Record Separator (decimal code point 30, hex 1E) -- separates elements within
 * the one array-valued field (`limitations`), kept distinct from `UNIT_SEPARATOR` so a
 * limitation string containing no control characters can never be mistaken for a field
 * boundary. */
const RECORD_SEPARATOR = String.fromCharCode(30);

/** Distinguishes an honestly-absent value (`null`) from an empty string at the same
 * field position -- never itself a plausible reported value for any nullable field
 * below (a cloud-coverage percentage, a capture time, a resolution in meters). */
const NULL_SENTINEL = "null";

function normalizeString(value: string): string {
  return (value ?? "").trim();
}

function normalizeNullableString(value: string | null): string {
  return value === null ? NULL_SENTINEL : normalizeString(value);
}

function normalizeNullableNumber(value: number | null): string {
  return value === null ? NULL_SENTINEL : String(value);
}

function normalizeNumber(value: number): string {
  return String(value);
}

function normalizeBoolean(value: boolean): string {
  return value ? "true" : "false";
}

/**
 * Builds the fixed-order, delimiter-joined serialization the checksum is computed
 * over. Field order is fixed and hardcoded here -- never derived from the input
 * object's own iteration order -- so the output is deterministic regardless of how
 * the caller happened to construct `observation`.
 */
function serialize(observation: SatelliteObservation): string {
  return [
    normalizeString(observation.observationId),
    normalizeString(observation.observationType),
    normalizeString(observation.provider.providerCode),
    normalizeString(observation.provider.dataset),
    normalizeString(observation.provider.sourceType),
    normalizeString(observation.provider.retrievedAt),
    normalizeNumber(observation.spatial.siteCoordinates.latitude),
    normalizeNumber(observation.spatial.siteCoordinates.longitude),
    normalizeNumber(observation.spatial.requestedRadiusKm),
    normalizeString(observation.spatial.coordinateEligibility),
    normalizeString(observation.spatial.coordinateStatus),
    normalizeNullableString(observation.temporal.captureTime),
    normalizeString(observation.temporal.retrievedAt),
    normalizeNullableNumber(observation.temporal.imageryAgeDays),
    normalizeString(observation.temporal.freshness),
    normalizeNullableNumber(observation.quality.cloudCoveragePercent),
    normalizeNullableNumber(observation.quality.noDataCoveragePercent),
    normalizeNullableNumber(observation.quality.spatialResolutionMeters),
    normalizeNumber(observation.quality.sourceConfidence),
    normalizeString(observation.quality.qualityClassification),
    normalizeBoolean(observation.quality.usable),
    normalizeString(observation.derivationMethod),
    observation.limitations.map(normalizeString).join(RECORD_SEPARATOR),
  ].join(UNIT_SEPARATOR);
}

/**
 * Computes a deterministic content fingerprint for one `SatelliteObservation`. Same
 * input always produces the same output; never throws; never mutates `observation`.
 */
export function computeSatelliteEvidenceChecksum(observation: SatelliteObservation): string {
  const digest = createHash("sha256").update(serialize(observation), "utf8").digest("hex");
  return `${CHECKSUM_VERSION_PREFIX}${digest}`;
}
