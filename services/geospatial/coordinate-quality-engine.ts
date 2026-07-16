// STAGE 1 -- WP1.2 Coordinate Quality Engine.
//
// Pure, dependency-free (no node:sqlite, no DB import -- see
// docs/stage-0/05_TEST_BASELINE.md's "Follow-up" sections for why that
// property matters for this codebase's test collection) classifier for a
// single site's coordinate quality. It never mutates or corrects a
// coordinate -- it only classifies what is already there and explains why,
// per the Stage 1 safety rule "no auto-correction, suggestions only."
//
// Duplicate-coordinate detection (exact / dense-cluster) is intentionally
// NOT computed inside this module: services/duplicates-engine.ts already
// does that by querying across all sites (Stage 0, WP0.6-era code), and
// re-implementing a second, independent duplicate detector here would risk
// the two silently drifting apart (same failure class the WP0.4 audit
// flagged for the Copernicus truth triplet). Instead, the caller (the
// spatial-intelligence-engine service that wires this up in a later
// checkpoint) passes in whatever duplicate/dense-cluster flags it already
// computed via the existing engine, and this module folds them into the
// single coordinate_status decision alongside the structural/bounds checks
// it does own.
import { classifyBrazilBounds, suspectedLatLonSwap } from "@/services/geospatial/brazil-bounds";

export const COORDINATE_QUALITY_ALGORITHM_VERSION = "1.0.0-stage1";

export const COORDINATE_STATUS_VALUES = [
  "valid",
  "missing",
  "invalid_latitude",
  "invalid_longitude",
  "invalid_pair",
  "outside_brazil",
  "zero_coordinate",
  "duplicate_exact",
  "duplicate_dense",
  "suspicious",
  "requires_review",
] as const;

export type CoordinateStatus = (typeof COORDINATE_STATUS_VALUES)[number];

export type CoordinateQualityInput = {
  latitude: number | null | undefined;
  longitude: number | null | undefined;
  // Precomputed by the caller from services/duplicates-engine.ts-style
  // queries -- this module does not query the database itself.
  isDuplicateExact?: boolean;
  isDuplicateDense?: boolean;
};

export type CoordinateQualityResult = {
  status: CoordinateStatus;
  eligibleForMapping: boolean;
  // "Sentinel eligible" means only that the coordinate is precise and
  // unambiguous enough to be worth using in a future Sentinel-1 scene
  // search -- it is NOT a claim that any satellite evidence exists, or that
  // Copernicus/Sentinel-1 integration is active. See
  // docs/stage-0/00_STAGE_0_SUMMARY.md and the Stage 1 mission's explicit
  // truthful-labeling requirement for WP1.17.
  eligibleForSentinel: boolean;
  confidence: number; // 0 (worst) - 1 (best), a relative ranking signal, not a probability
  reasons: string[];
  warnings: string[];
  evaluatedAt: string;
  algorithmVersion: string;
};

const CONFIDENCE_BY_STATUS: Record<CoordinateStatus, number> = {
  valid: 1,
  duplicate_dense: 0.7,
  duplicate_exact: 0.6,
  suspicious: 0.5,
  requires_review: 0.4,
  outside_brazil: 0.2,
  zero_coordinate: 0,
  missing: 0,
  invalid_latitude: 0,
  invalid_longitude: 0,
  invalid_pair: 0,
};

// Coordinates that at least land inside (or near the border of) Brazil are
// shown on the map even if their quality is uncertain -- the map is where a
// human notices and investigates a suspicious point. Coordinates that are
// missing, structurally invalid, zeroed, or plainly outside Brazil are not
// mapping-eligible: plotting them would misrepresent the network's
// geography rather than surface a data-quality issue.
const MAPPING_ELIGIBLE_STATUSES = new Set<CoordinateStatus>([
  "valid",
  "duplicate_exact",
  "duplicate_dense",
  "suspicious",
  "requires_review",
]);

// Sentinel eligibility is deliberately the strictest tier: only a
// structurally valid, comfortably-inside-Brazil, non-duplicate,
// non-suspicious coordinate is precise/unambiguous enough to anchor a
// future satellite scene search against a single point on the ground.
const SENTINEL_ELIGIBLE_STATUSES = new Set<CoordinateStatus>(["valid"]);

function isFiniteCoordinate(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function evaluateCoordinateQuality(
  input: CoordinateQualityInput,
  now: () => string = () => new Date().toISOString(),
): CoordinateQualityResult {
  const { latitude, longitude, isDuplicateExact = false, isDuplicateDense = false } = input;
  const reasons: string[] = [];
  const warnings: string[] = [];
  let status: CoordinateStatus;

  const latitudeMissing = latitude === null || latitude === undefined;
  const longitudeMissing = longitude === null || longitude === undefined;

  if (latitudeMissing || longitudeMissing) {
    status = "missing";
    reasons.push(
      latitudeMissing && longitudeMissing
        ? "Latitude e longitude ausentes."
        : latitudeMissing
          ? "Latitude ausente."
          : "Longitude ausente.",
    );
  } else if (!isFiniteCoordinate(latitude) || latitude < -90 || latitude > 90) {
    status = "invalid_latitude";
    reasons.push(`Latitude fora do intervalo valido (-90 a 90): ${String(latitude)}.`);
  } else if (!isFiniteCoordinate(longitude) || longitude < -180 || longitude > 180) {
    status = "invalid_longitude";
    reasons.push(`Longitude fora do intervalo valido (-180 a 180): ${String(longitude)}.`);
  } else if (latitude === longitude && latitude !== 0) {
    // Latitude identical to longitude (and not the also-covered 0,0 case)
    // is a strong signature of a copy-paste data-entry error rather than a
    // real coordinate pair.
    status = "invalid_pair";
    reasons.push("Latitude e longitude identicas -- par de coordenadas provavelmente invalido.");
  } else if (latitude === 0 && longitude === 0) {
    status = "zero_coordinate";
    reasons.push("Coordenada zerada (0, 0) -- valor tipico de campo nao preenchido.");
  } else {
    const boundsClass = classifyBrazilBounds(latitude, longitude);
    const swapSuspected = suspectedLatLonSwap(latitude, longitude);

    if (boundsClass === "outside" && !swapSuspected) {
      status = "outside_brazil";
      reasons.push("Coordenada fora do retangulo delimitador do Brasil.");
    } else if (swapSuspected) {
      status = "suspicious";
      reasons.push("Par de coordenadas fora do Brasil, mas a troca latitude/longitude cairia dentro do Brasil -- possivel inversao.");
    } else if (isDuplicateExact) {
      status = "duplicate_exact";
      reasons.push("Coordenada identica (6 casas decimais) a de outro site.");
    } else if (isDuplicateDense) {
      status = "duplicate_dense";
      reasons.push("Coordenada dentro de um agrupamento denso de coordenadas proximas (~100m).");
    } else if (boundsClass === "near_border") {
      status = "requires_review";
      reasons.push("Coordenada proxima ao limite do retangulo delimitador do Brasil -- requer revisao manual.");
    } else {
      status = "valid";
    }

    // Non-status-changing extra signals, surfaced as warnings so they are
    // not lost even when a higher-priority status wins.
    if (status !== "duplicate_exact" && isDuplicateExact) warnings.push("Tambem identificada como duplicata exata de coordenada.");
    if (status !== "duplicate_dense" && isDuplicateDense) warnings.push("Tambem identificada dentro de um agrupamento denso de coordenadas.");
  }

  return {
    status,
    eligibleForMapping: MAPPING_ELIGIBLE_STATUSES.has(status),
    eligibleForSentinel: SENTINEL_ELIGIBLE_STATUSES.has(status),
    confidence: CONFIDENCE_BY_STATUS[status],
    reasons,
    warnings,
    evaluatedAt: now(),
    algorithmVersion: COORDINATE_QUALITY_ALGORITHM_VERSION,
  };
}
