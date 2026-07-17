import type { SiteRow } from "@/lib/types";
import type { Site } from "@/services/intelligence";
import type { EntityReference } from "@/services/intelligence";
import type {
  SiteId,
  MunicipalityId,
  StateId,
  OperatorId,
  TechnologyId,
  TowerCompanyId,
} from "@/services/intelligence/types/identifiers";
import { toIdentifier, toIsoDateTime, validateBaseEntityShape } from "@/services/intelligence";

/**
 * Genesis Phase 2 — Increment 3 (Site Entity Adapter).
 *
 * Pure, dependency-free translation from the legacy site row shape into the
 * canonical `Site` entity (`services/intelligence/entities/site.ts`), per
 * `docs/genesis-phase-2/02_CANONICAL_DOMAIN_MODEL.md`'s "Site" section and
 * `08_ADAPTER_STRATEGY.md`'s adapter #1: "pure function `siteRow →
 * EntityReference<"Site">`/`Site`. No DB access of its own (the caller
 * already has the row)."
 *
 * Input type: `SiteRow` (`@/lib/types`), which is the existing, already
 * repository-defined TypeScript shape of `services/site-service.ts`'s
 * `siteRow()` return value — reused here rather than redeclared, per the
 * frozen architecture's own "`siteRow` →" wording. This module deliberately
 * does NOT import `services/site-service.ts` itself: that file imports
 * `{ text } from "@/lib/db"`, which opens a real `node:sqlite` database at
 * module scope. `lib/types.ts` has zero imports and is fully pure, so
 * importing `SiteRow` from there (instead of importing the function that
 * produces it) is what keeps this adapter importable and testable with
 * plain object literals, no database, no I/O — matching
 * `services/geospatial/compact-site.ts`'s own established precedent for
 * exactly this problem.
 *
 * IMPORTANT SCOPE NOTE: the canonical `Site` interface is a *reference*
 * contract (`kind`, `id`, `municipalityId`, `stateId`, `operatorId`,
 * `towerCompanyId`, `technologyIds` — plus `BaseEntity`'s `createdAt`/
 * `updatedAt`/`version`/`metadata`). It has no `latitude`/`longitude`/
 * `endereco`/`status`/`altura` fields at all — those belong to other,
 * later, not-yet-built adapters (Coordinate Assessment, Data Quality,
 * Evidence). This adapter does not invent canonical fields to avoid
 * "losing" that data; instead, a handful of raw legacy values are preserved
 * in `SiteAdaptationResult.sourceReference` purely for traceability, per
 * Step 6/8 of this increment's own instructions. See
 * `docs/genesis-phase-2/19_INCREMENT_3_SITE_ENTITY_ADAPTER.md` for the full
 * field-by-field mapping table and rationale.
 */

/** The exact placeholder string `lib/db.ts`'s `text()` emits for any
 * null/undefined raw column value. Recognizing this is what lets the
 * adapter distinguish "the legacy row never had this value" from "the
 * legacy row genuinely contains the literal text 'Não informado'" — the
 * former is what actually happens in practice; this module treats both
 * identically as absence, since there is no way to tell them apart once
 * `siteRow()` has already run (a known, documented upstream limitation,
 * not something this adapter can fix without touching `lib/db.ts`, which is
 * out of scope for an adapter-only increment). */
const LEGACY_PLACEHOLDER = "Não informado";

export type { SiteRow as LegacySiteRow } from "@/lib/types";

export type SiteAdaptationIssueCode =
  | "invalid_database_id"
  | "missing_municipality"
  | "missing_uf"
  | "missing_timestamp"
  | "missing_operator"
  | "missing_tower_company"
  | "missing_technology"
  | "missing_site_code"
  | "invalid_coordinate_number"
  | "invalid_canonical_shape";

/**
 * A single structured adaptation finding. Reuses `Limitation`'s existing
 * `"informational" | "moderate" | "significant"` severity vocabulary
 * (`services/intelligence/contracts/limitation.ts`) rather than inventing a
 * new one. Never carries a raw legacy value in `message` — only in the
 * caller-facing `SiteAdaptationResult.sourceReference`, which is
 * deliberately narrow (a handful of named fields, never a full row dump).
 */
export interface SiteAdaptationIssue {
  readonly code: SiteAdaptationIssueCode;
  /** The `LegacySiteRow` field this issue concerns, or `""` for a
   * row-level/whole-entity issue. */
  readonly field: string;
  readonly severity: "informational" | "moderate" | "significant";
  readonly message: string;
  /** Whether adaptation can still produce a canonical `Site` despite this
   * issue. `false` means this issue alone is sufficient to make
   * `SiteAdaptationResult.success` false. */
  readonly canContinue: boolean;
}

/**
 * A narrow, explicitly-chosen set of raw legacy values preserved for
 * traceability back to the source row — never the full row. `latitude`/
 * `longitude` are parsed defensively (`Number(...)`, tolerating a numeric
 * string) but never corrected, swapped, or geocoded; `null` means the
 * parsed value was not finite, with the untouched raw input kept alongside
 * it in `rawLatitude`/`rawLongitude`.
 */
export interface SiteSourceReference {
  readonly legacyRowId: number;
  readonly legacySiteCode: string;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly rawLatitude: number;
  readonly rawLongitude: number;
}

export interface SiteAdaptationResult {
  readonly success: boolean;
  /** The canonical `Site`, present only when `success` is `true`. */
  readonly site: Site | null;
  readonly issues: readonly SiteAdaptationIssue[];
  readonly sourceReference: SiteSourceReference;
  /** `LegacySiteRow` fields with no representation anywhere in the
   * canonical `Site` contract (see the module header note above) — a
   * fixed, documented list, not a per-row computation. */
  readonly unmappedFields: readonly string[];
}

/** Fields on `LegacySiteRow`/`SiteRow` that the canonical `Site` contract
 * has no field for at all. Listed once, statically, per Step 6's
 * instruction to document unmapped fields explicitly rather than silently
 * drop or awkwardly force them into `metadata`. */
export const SITE_ADAPTER_UNMAPPED_FIELDS: readonly string[] = [
  "siteId",
  "elemento",
  "regional",
  "endereco",
  "status",
  "projeto",
  "tipoSite",
  "tipoInfra",
  "latitude",
  "longitude",
  "populacao",
  "altura",
  "geoScore",
  "risco",
  "stationId",
  "oriScore",
  "oriRisk",
  "arquivoOrigem",
];

function issue(
  code: SiteAdaptationIssueCode,
  field: string,
  severity: SiteAdaptationIssue["severity"],
  message: string,
  canContinue: boolean,
): SiteAdaptationIssue {
  return { code, field, severity, message, canContinue };
}

/** Trims a legacy string field and reports whether it is effectively
 * absent (empty after trimming, or exactly the known legacy placeholder).
 * Never alters the value beyond whitespace trimming — no case changes, no
 * character stripping — so a caller that inspects the returned `value`
 * still sees genuine source content, mojibake included, byte for byte. */
function readLegacyString(raw: string): { value: string; isAbsent: boolean } {
  const trimmed = raw.trim();
  return { value: trimmed, isAbsent: trimmed.length === 0 || trimmed === LEGACY_PLACEHOLDER };
}

/**
 * Deterministically normalizes a legacy string into a stable identifier
 * key: trims, strips diacritics (NFD decomposition), and upper-cases.
 * Mirrors `services/data-quality-engine.ts`'s existing `normalizeAddress()`
 * canonicalization convention (`03_INTELLIGENCE_PIPELINE.md` Stage 2 cites
 * it as "the closest existing example") without importing that module —
 * importing a legacy engine file is out of this adapter's scope. Unlike
 * `normalizeAddress()`, punctuation is not stripped, since a Municipality/
 * Operator/Technology name's internal punctuation is not noise the way a
 * free-text address's is; only whitespace is collapsed.
 *
 * This is a *key derivation* for a branded identifier, never a display
 * value and never written back onto the entity itself — the entity only
 * ever stores the resulting branded id, not this normalized string.
 */
function toStableKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

function parseCoordinate(raw: number): number | null {
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Adapts one legacy `SiteRow` into a canonical `Site`, deterministically
 * and without I/O. Never throws for malformed legacy data — a structurally
 * unusable row simply yields `success: false` with structured `issues`.
 * The input object is never mutated, and no reference into it is returned.
 */
export function adaptLegacySiteRow(input: SiteRow): SiteAdaptationResult {
  const issues: SiteAdaptationIssue[] = [];

  const legacyRowId = input.id;
  const rawLatitude = input.latitude;
  const rawLongitude = input.longitude;
  const latitude = parseCoordinate(rawLatitude);
  const longitude = parseCoordinate(rawLongitude);
  if (latitude === null) {
    issues.push(issue("invalid_coordinate_number", "latitude", "moderate", "Latitude is not a finite number.", true));
  }
  if (longitude === null) {
    issues.push(issue("invalid_coordinate_number", "longitude", "moderate", "Longitude is not a finite number.", true));
  }

  const siteCode = readLegacyString(input.site);
  if (siteCode.isAbsent) {
    issues.push(issue("missing_site_code", "site", "informational", "Telecom site code is absent or a placeholder.", true));
  }

  const sourceReference: SiteSourceReference = {
    legacyRowId,
    legacySiteCode: input.site,
    latitude,
    longitude,
    rawLatitude,
    rawLongitude,
  };

  let siteIdValue: SiteId | null = null;
  if (Number.isInteger(legacyRowId) && legacyRowId > 0) {
    siteIdValue = toIdentifier<"Site">(String(legacyRowId));
  } else {
    issues.push(issue("invalid_database_id", "id", "significant", "Database row id is not a positive integer.", false));
  }

  const municipio = readLegacyString(input.municipio);
  if (municipio.isAbsent) {
    issues.push(issue("missing_municipality", "municipio", "significant", "Municipality is absent or a placeholder.", false));
  }

  const uf = readLegacyString(input.uf);
  if (uf.isAbsent) {
    issues.push(issue("missing_uf", "uf", "significant", "State (UF) is absent or a placeholder.", false));
  }

  let stateIdValue: StateId | null = null;
  let municipalityIdValue: MunicipalityId | null = null;
  if (!uf.isAbsent) {
    stateIdValue = toIdentifier<"State">(toStableKey(uf.value));
  }
  if (!municipio.isAbsent && !uf.isAbsent) {
    municipalityIdValue = toIdentifier<"Municipality">(`${toStableKey(uf.value)}|${toStableKey(municipio.value)}`);
  }

  const operador = readLegacyString(input.operadora);
  if (operador.isAbsent) {
    issues.push(issue("missing_operator", "operadora", "informational", "Operator is absent or a placeholder.", true));
  }
  const operatorIdValue: OperatorId | null = operador.isAbsent ? null : toIdentifier<"Operator">(toStableKey(operador.value));

  const detentorInfra = readLegacyString(input.detentorInfra);
  if (detentorInfra.isAbsent) {
    issues.push(issue("missing_tower_company", "detentorInfra", "informational", "Tower/infrastructure holder is absent or a placeholder.", true));
  }
  const towerCompanyIdValue: TowerCompanyId | null = detentorInfra.isAbsent
    ? null
    : toIdentifier<"TowerCompany">(toStableKey(detentorInfra.value));

  const tecnologia = readLegacyString(input.tecnologia);
  if (tecnologia.isAbsent) {
    issues.push(issue("missing_technology", "tecnologia", "informational", "Technology is absent or a placeholder.", true));
  }
  // Deliberately not split into multiple tokens: no existing repository
  // convention parses `tecnologia` into discrete values (other code only
  // does `LIKE '%5G%'`-style substring checks), and inventing a splitting
  // rule here would be new business logic, out of an adapter's mandate.
  const technologyIdsValue: readonly TechnologyId[] = tecnologia.isAbsent
    ? []
    : [toIdentifier<"Technology">(toStableKey(tecnologia.value))];

  const dataImportacao = readLegacyString(input.dataImportacao);
  let timestamp: string | null = null;
  if (dataImportacao.isAbsent || Number.isNaN(Date.parse(dataImportacao.value))) {
    issues.push(issue("missing_timestamp", "dataImportacao", "significant", "Import date is absent, a placeholder, or not a valid date.", false));
  } else {
    timestamp = dataImportacao.value;
  }

  if (siteIdValue === null || stateIdValue === null || municipalityIdValue === null || timestamp === null) {
    return {
      success: false,
      site: null,
      issues,
      sourceReference,
      unmappedFields: SITE_ADAPTER_UNMAPPED_FIELDS,
    };
  }

  const isoTimestamp = toIsoDateTime(timestamp);

  const site: Site = {
    kind: "Site",
    id: siteIdValue,
    createdAt: isoTimestamp,
    updatedAt: isoTimestamp,
    // No revision-tracking mechanism exists for a stateless, non-persisting
    // adapter (Increment 3 does not add persistence) -- every adaptation
    // starts at a fixed initial revision, never fabricated per-row data.
    version: 1,
    metadata: { legacySiteCode: input.site },
    municipalityId: municipalityIdValue,
    stateId: stateIdValue,
    operatorId: operatorIdValue,
    towerCompanyId: towerCompanyIdValue,
    technologyIds: technologyIdsValue,
  };

  const structural = validateBaseEntityShape(site);
  if (!structural.valid) {
    for (const structuralIssue of structural.issues) {
      issues.push(
        issue(
          "invalid_canonical_shape",
          structuralIssue.path,
          "significant",
          structuralIssue.message,
          false,
        ),
      );
    }
    return {
      success: false,
      site: null,
      issues,
      sourceReference,
      unmappedFields: SITE_ADAPTER_UNMAPPED_FIELDS,
    };
  }

  return {
    success: true,
    site,
    issues,
    sourceReference,
    unmappedFields: SITE_ADAPTER_UNMAPPED_FIELDS,
  };
}

/** Small convenience helper: every other future adapter needs an
 * `EntityReference<"Site">` to attach its own output to
 * (`08_ADAPTER_STRATEGY.md`'s stated reason this adapter comes first). Not
 * a second translation path — just narrows an already-adapted `Site`. */
export function toSiteEntityReference(site: Site): EntityReference<"Site"> {
  return { kind: site.kind, id: site.id };
}
