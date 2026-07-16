/**
 * Shared primitive types for the Sentinel Intelligence Foundation.
 *
 * WHY THIS FILE EXISTS
 * ---------------------------------------------------------------------------
 * Every other module in `services/intelligence` builds on a small set of
 * primitives (timestamps, semantic versions, confidence scores, opaque
 * metadata bags, generic JSON values). If each contract file re-declared its
 * own notion of "a timestamp" or "a 0..1 confidence number", two engines
 * built a year apart would silently drift — one might use epoch millis,
 * another an ISO string, a third a Date instance. That drift is exactly the
 * failure mode Genesis Phase 1 exists to prevent: it is the difference
 * between "every engine speaks the same language" and "every engine speaks
 * its own dialect that happens to compile."
 *
 * These types intentionally carry no behavior. They exist to be imported,
 * not instantiated — the Intelligence Foundation is a set of nouns, not
 * verbs.
 */

/**
 * An ISO-8601 date-time string (e.g. "2026-07-16T14:00:00.000Z").
 *
 * Branded so a plain `string` cannot be assigned to a timestamp field by
 * accident. Use {@link toIsoDateTime} (validation/validators.ts) to obtain
 * one from an unknown value in an engine boundary.
 */
export type IsoDateTime = string & { readonly __brand: "IsoDateTime" };

/**
 * A semantic version string in `MAJOR.MINOR.PATCH` form, with an optional
 * `-prerelease` and/or `+build` suffix (e.g. "2.1.0", "1.0.0-beta.1").
 *
 * Every contract, every engine declaration, and every score carries at least
 * one of these (see versioning/version.ts). Representing it as a branded
 * string — rather than as three loose numbers scattered across an
 * interface — keeps "what version is this?" answerable with a single field
 * read, and keeps comparison logic (versioning/compatibility.ts) in exactly
 * one place.
 */
export type SemVerString = string & { readonly __brand: "SemVerString" };

/**
 * A confidence, reliability, or weight value constrained to the closed
 * interval [0, 1].
 *
 * Confidence appears on Scores, Evidence, and Recommendations. Left as a
 * bare `number`, nothing would stop an engine from emitting `confidence: 87`
 * (a percentage, not a unit interval) and silently corrupting every
 * downstream aggregation. The brand does not enforce the range at the type
 * level (TypeScript cannot express numeric ranges), but it does force
 * callers through a validated constructor (see validation/validators.ts)
 * rather than an unchecked literal.
 */
export type UnitInterval = number & { readonly __brand: "UnitInterval" };

/**
 * Free-form, read-only key/value metadata attached to every canonical
 * entity and every intelligence contract.
 *
 * Metadata is deliberately open-ended (`JsonValue`, not `unknown`) so it can
 * be serialized, logged, diffed, and stored without an engine needing to
 * know what a *different* engine chose to put there. It is not a substitute
 * for a typed field: if a value needs to be relied upon structurally, it
 * belongs in the contract itself, not in `metadata`.
 */
export type Metadata = Readonly<Record<string, JsonValue>>;

/**
 * A JSON-serializable value. Used anywhere a contract needs to accept
 * "arbitrary but serializable" data (metadata, execution details, engine
 * extensions) without resorting to `any`.
 */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

/**
 * A opaque, strongly-typed identifier for entities of kind `TKind`.
 *
 * `Identifier<"Site">` and `Identifier<"Operator">` are both strings at
 * runtime but are mutually incompatible at the type level, so a `SiteId`
 * can never be passed where an `OperatorId` is expected — a class of bug
 * ("wrong id, right shape") that a bare `string` id cannot catch.
 */
export type Identifier<TKind extends string> = string & {
  readonly __entityKind: TKind;
};

/**
 * A lightweight pointer to any canonical entity, used whenever a contract
 * needs to refer to "some entity" without embedding the entire entity
 * (Scores, Recommendations, and Evidence all reference entities this way).
 */
export interface EntityReference<TKind extends string = string> {
  readonly kind: TKind;
  readonly id: Identifier<TKind>;
}

/**
 * A non-empty, read-only array. Used where a contract must guarantee at
 * least one element (e.g. a Score must have a calculation timestamp source,
 * a Recommendation must affect at least one entity) — structurally, not by
 * convention.
 */
export type NonEmptyArray<T> = readonly [T, ...T[]];
