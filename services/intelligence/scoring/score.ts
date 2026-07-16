import type { BaseEntity } from "../contracts/entity";
import type { Limitation } from "../contracts/limitation";
import type { ExecutionMetadata } from "../contracts/execution-metadata";
import type { ScoreId, EvidenceId } from "../types/identifiers";
import type { EntityReference, IsoDateTime, SemVerString, UnitInterval } from "../types/common";
import type { ScoreType, ScoreClassification, ScoreDriver } from "./classification";

/**
 * The official Score contract.
 *
 * WHY THIS EXISTS
 * ---------------------------------------------------------------------------
 * Every intelligence engine the mission names (Risk, Opportunity,
 * Confidence, Priority, Data Trust, Forecast, Simulation, Optimization,
 * Executive AI, ...) ultimately produces the same kind of thing: a judgment
 * about some entity, with a number, a classification, a confidence level,
 * and a trail of *why*. Before this contract, each future engine would be
 * free to invent its own result shape — one returning `{ score, level }`,
 * another `{ value, risk_class, certainty }` — and nothing downstream (a
 * dashboard, an audit trail, a second engine consuming a first engine's
 * output) could treat them uniformly. `Score` is the single shape every
 * engine's output must satisfy, regardless of what the engine actually
 * computes internally.
 *
 * `Score` extends {@link BaseEntity} because a produced score has its own
 * lifecycle independent of the entity it scores (it can be recalculated,
 * superseded, or annotated after the fact) — `BaseEntity.id` fills the role
 * the mission brief calls "identifier", and `BaseEntity.metadata` fills the
 * role the mission brief calls "future compatibility": both are inherited
 * rather than re-declared, so this contract has exactly one field per
 * concept.
 */
export interface Score extends BaseEntity<"Score"> {
  readonly kind: "Score";
  readonly id: ScoreId;

  /** The entity this score is about. */
  readonly entity: EntityReference;

  /** What kind of score this is (e.g. "risk", "opportunity"). See
   * {@link ScoreType}. */
  readonly type: ScoreType;

  /** The score's numeric value. Deliberately unconstrained (not forced
   * into [0, 1] or [0, 100]) because different score types have different
   * natural ranges; `classification` is what gives a value comparable
   * meaning across types. */
  readonly value: number;

  /** Human-meaningful classification of `value` (e.g. "HIGH"). See
   * {@link ScoreClassification}. */
  readonly classification: ScoreClassification;

  /** How confident the producing engine is in this score, independent of
   * the score's own value — a HIGH-risk score can be reported with low
   * confidence, and that distinction must survive into the contract. */
  readonly confidence: UnitInterval;

  /** Version of the engine that produced this score (see
   * versioning/version.ts). */
  readonly engineVersion: SemVerString;

  /** Version of *this* Score contract that the value was produced against,
   * distinct from `engineVersion` — the engine can be upgraded without the
   * contract changing, and vice versa. */
  readonly contractVersion: SemVerString;

  /** The factors that produced `value`, in explanation order. */
  readonly drivers: readonly ScoreDriver[];

  /** References to the {@link Evidence} records supporting this score. */
  readonly evidence: readonly EvidenceId[];

  /** Known limitations on trusting this score. */
  readonly limitations: readonly Limitation[];

  /** When the calculation that produced this score's value was
   * performed. Distinct from `BaseEntity.createdAt`, which is when this
   * Score *record* was created — the two are expected to be equal in the
   * common case but are allowed to diverge (e.g. a score recomputed
   * offline and imported later). */
  readonly calculatedAt: IsoDateTime;

  /** Details of the specific engine execution that produced this score. */
  readonly executionMetadata: ExecutionMetadata;
}
