import type { Limitation } from "@/services/intelligence";
import type { SnapshotId } from "@/services/intelligence/types/identifiers";
import { toIdentifier } from "@/services/intelligence";

/**
 * Genesis Phase 2 — Increment 7 (Minimal Snapshot Provider).
 *
 * Pure, dependency-free derivation of a deterministic `SnapshotId`
 * (`02_CANONICAL_DOMAIN_MODEL.md`'s "Dataset Snapshot" section;
 * `docs/genesis-phase-2/23_INCREMENT_6_5_ARCHITECTURAL_DECISIONS.md` Decision B,
 * ADR-017) from already-existing legacy import metadata. No database access, no
 * `Date.now()`, no random value, no persisted Snapshot record — the result is
 * always disclosed as "derived" or "synthetic", never presented as a genuine
 * persisted snapshot.
 *
 * REPOSITORY-SPECIFIC REFINEMENT OF ADR-017 (see `24_INCREMENT_7_CANONICAL_DATA_TRUST_PATH.md`
 * Section 7 for the full record): `lib/db.ts`'s `text()` helper -- the function every
 * legacy string field in `siteRow()` is built from -- returns
 * `String(value ?? "Não informado")`. A raw-NULL `data_importacao`/`arquivo_origem`
 * column therefore never reaches this module as an empty string or `null`/`undefined`;
 * it arrives as the literal placeholder `"Não informado"`. This is the exact same
 * placeholder-recognition problem Increment 3's `site-entity-adapter.ts` already solved
 * (`LEGACY_PLACEHOLDER`/`readLegacyString`) -- this module reuses that identical
 * recognition rule rather than inventing a second, subtly different one. Treating the
 * placeholder as a genuine import date would be a fabrication (claiming to know when a
 * Site was imported when the legacy row carries no such information at all).
 */

const LEGACY_PLACEHOLDER = "Não informado";

export type SnapshotSourceKind = "derived" | "synthetic";
export type SnapshotSourceField = "data_importacao" | "arquivo_origem" | "fallback";

export interface SnapshotProviderInput {
  readonly dataImportacao: string;
  readonly arquivoOrigem: string;
}

export interface SnapshotDerivation {
  readonly snapshotId: SnapshotId;
  readonly kind: SnapshotSourceKind;
  readonly source: SnapshotSourceField;
  /** Present only when the synthetic fallback fired -- discloses that no real
   * import-time signal was available for this Site, per Decision B's disclosure
   * requirement. `null` when a genuine `derived` snapshot was produced. */
  readonly limitation: Limitation | null;
}

/** Trims a legacy string field and reports whether it is effectively absent
 * (empty after trimming, or exactly the known legacy placeholder) -- mirrors
 * `site-entity-adapter.ts`'s `readLegacyString` precisely. */
function readLegacyString(raw: string): { value: string; isAbsent: boolean } {
  const trimmed = (raw ?? "").trim();
  return { value: trimmed, isAbsent: trimmed.length === 0 || trimmed === LEGACY_PLACEHOLDER };
}

const SYNTHETIC_FALLBACK_ID = "synthetic:no-import-metadata";

/**
 * Derives a deterministic `SnapshotId` for one Site, preferring
 * `dataImportacao` over `arquivoOrigem` over a fixed synthetic literal, per
 * ADR-017's priority order. Never throws; never mutates `input`.
 */
export function deriveSiteSnapshot(input: SnapshotProviderInput): SnapshotDerivation {
  const dataImportacao = readLegacyString(input.dataImportacao);
  if (!dataImportacao.isAbsent) {
    return {
      snapshotId: toIdentifier<"Snapshot">(`derived:data-importacao:${dataImportacao.value}`),
      kind: "derived",
      source: "data_importacao",
      limitation: null,
    };
  }

  const arquivoOrigem = readLegacyString(input.arquivoOrigem);
  if (!arquivoOrigem.isAbsent) {
    return {
      snapshotId: toIdentifier<"Snapshot">(`derived:arquivo-origem:${arquivoOrigem.value}`),
      kind: "derived",
      source: "arquivo_origem",
      limitation: null,
    };
  }

  return {
    snapshotId: toIdentifier<"Snapshot">(SYNTHETIC_FALLBACK_ID),
    kind: "synthetic",
    source: "fallback",
    limitation: {
      description:
        "No real import-time signal (dataImportacao or arquivoOrigem) was available for this Site; " +
        "the Snapshot id is a fixed synthetic placeholder, not derived from any genuine import metadata.",
      severity: "informational",
    },
  };
}
