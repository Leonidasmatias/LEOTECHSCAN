/**
 * Barrel export for the shared primitive types. Import from
 * `@/services/intelligence/types` rather than reaching into individual
 * files, so the internal module layout can change without breaking
 * downstream engines.
 */
export type {
  IsoDateTime,
  SemVerString,
  UnitInterval,
  Metadata,
  JsonValue,
  Identifier,
  EntityReference,
  NonEmptyArray,
} from "./common";
