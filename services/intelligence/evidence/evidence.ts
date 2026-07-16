import type { BaseEntity } from "../contracts/entity";
import type { EvidenceId, SnapshotId } from "../types/identifiers";
import type { UnitInterval } from "../types/common";
import type { DataProvenance } from "./provenance";

/**
 * The official evidence structure.
 *
 * WHY THIS EXISTS
 * ---------------------------------------------------------------------------
 * Every engine listed in the mission (Risk, Opportunity, Confidence,
 * Priority, Data Trust, Recommendation, ML, Simulation, Forecast,
 * Optimization, Executive AI) needs to justify its output with *something*.
 * Without a shared Evidence contract, each engine would invent its own
 * "why" format, and nothing downstream (a UI, an audit log, another engine
 * consuming a Score) could render or compare evidence across engines. This
 * contract is that single, reusable "why" format — designed once, used by
 * all of them.
 *
 * Evidence is itself a canonical entity (it has an id/lifecycle, because a
 * piece of evidence can be superseded, re-weighted, or invalidated
 * independently of the Score/Recommendation that cites it), which is why it
 * extends {@link BaseEntity} rather than being a bare value object.
 */
export interface Evidence extends BaseEntity<"Evidence"> {
  readonly kind: "Evidence";
  readonly id: EvidenceId;

  /** Where this evidence came from, in human-readable form (e.g. "ANATEL
   * licensing dataset", "Copernicus satellite validation"). Complements
   * `origin` (the full machine-tractable provenance) with something a
   * person reading a Recommendation can understand at a glance. */
  readonly source: string;

  /** Human-readable explanation of what this evidence shows. */
  readonly description: string;

  /** Relative importance of this evidence within the set of evidence
   * supporting a single Score or Recommendation. Not required to sum to 1
   * across a set — callers that need normalized weights do that
   * normalization themselves; this field only expresses relative
   * intent. */
  readonly weight: number;

  /** How trustworthy this evidence is judged to be, independent of its
   * weight. A highly-weighted but low-reliability piece of evidence is a
   * legitimate, explainable state (e.g. "the most decisive input we have is
   * also the least certain one"). */
  readonly reliability: UnitInterval;

  /** The immutable snapshot this evidence was drawn from. Kept as a direct
   * field (rather than requiring callers to unpack `origin`) because "which
   * snapshot" is checked far more often than the rest of the lineage — most
   * consumers only need to compare snapshot ids, not walk the full
   * provenance chain. */
  readonly snapshot: SnapshotId;

  /** Full machine-tractable data lineage for this evidence. */
  readonly origin: DataProvenance;

  /** Content-integrity checksum of the evidence payload at the time it was
   * recorded, for the same cheap-comparison reason as `snapshot`. Must
   * match `origin.checksum` when both are dereferenced from the same
   * snapshot; kept as its own field for callers that only need to detect
   * drift, not explain it. */
  readonly checksum: string;

  /** Free-form supporting references (URLs, document ids, ticket numbers,
   * citation strings) a reader can follow to verify this evidence
   * independently. */
  readonly references: readonly string[];
}
