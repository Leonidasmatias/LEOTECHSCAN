import type { EngineDeclaration, EngineId } from "@/services/intelligence";
import type { SemVerString } from "@/services/intelligence";

/**
 * Genesis Phase 2 — Increment 2 (Engine Manifest / Runtime Registry).
 *
 * The canonical manifest shape frozen in docs/genesis-phase-2/07_ENGINE_MANIFEST.md.
 * Lives in `services/intelligence-runtime/`, not `services/intelligence/`, per that
 * document's own resolution and `14_IMPLEMENTATION_ROADMAP.md` Increment 2's file list
 * ("default to keeping it in intelligence-runtime/ per Principle 13's conservatism about
 * touching services/intelligence/ itself"). `services/intelligence/**` is not modified by
 * this increment.
 *
 * This file has no dependency on Next.js, node:sqlite, or any legacy engine. It contains
 * no executable business logic, no metadata bag, and no field capable of holding a secret
 * or environment value by construction — the shape is closed and every field is a plain,
 * typed, serializable value.
 */

/** `10_SECURITY_BOUNDARY.md`'s six-role classification, restated as a closed union so a
 * manifest's `securityRequirement` can only be one of the roles that document defines. */
export const SECURITY_ROLES = [
  "public-read",
  "authenticated-read",
  "privileged-recalculation",
  "privileged-export",
  "admin",
  "system-only",
] as const;

export type SecurityRole = (typeof SECURITY_ROLES)[number];

export const HEALTH_CHECK_KINDS = ["none", "self", "dependency-chain"] as const;
export type HealthCheckKind = (typeof HEALTH_CHECK_KINDS)[number];

export const MANIFEST_SCOPES = ["site", "municipality", "state", "global"] as const;
export type ManifestScope = (typeof MANIFEST_SCOPES)[number];

/** A single named, typed input or output port a manifest declares. */
export interface ManifestPort {
  readonly name: string;
  /** A `services/intelligence` contract name, e.g. `"Score<data-trust>"`. Descriptive
   * only — this is not itself a type reference the compiler checks. */
  readonly shape: string;
  readonly required: boolean;
}

export interface ManifestObservability {
  /** Event-type names this engine is known to emit today (e.g. via the existing
   * `recordAudit` pattern), or will emit once implemented. Defaults to an empty array. */
  readonly emitsEvents: readonly string[];
  readonly healthCheck: HealthCheckKind;
}

/**
 * `EngineManifest` extends Phase 1's `EngineDeclaration` (id, name, description, status,
 * version, capabilities, owner — unchanged, inherited) with the fields
 * `07_ENGINE_MANIFEST.md` requires for a manifest. `engineVersion`/`contractVersion` here
 * are the flat `SemVerString` restatement of `EngineDeclaration.version`'s structured
 * `SemanticVersion` fields, exactly as that document specifies — a deliberate, documented
 * duplication for the manifest's flatter shape, not independent data.
 */
export interface EngineManifest extends EngineDeclaration {
  readonly engineVersion: SemVerString;
  readonly contractVersion: SemVerString;
  /** New versioning axis (`04_ENGINE_LIFECYCLE.md`) — tracks `config/*.json` input changes
   * independently of code changes. Not present in Phase 1's `EngineVersionInfo`. */
  readonly configurationVersion: string;
  /** Must resolve to a `config/capabilities.json` entry's `key` once this engine is real
   * (`07_ENGINE_MANIFEST.md`'s capability-linkage rule). Validated structurally (non-empty
   * string) by this increment; cross-referencing against the live file is
   * `16_QUALITY_GATES.md`'s separate mechanical check, not built here. */
  readonly capabilityKey: string;
  readonly inputs: readonly ManifestPort[];
  readonly outputs: readonly ManifestPort[];
  /** Other canonical, registered `EngineId`s this engine's (future) adapter calls through
   * the orchestrator. Never lists grandfathered legacy imports (Principle 11). */
  readonly dependencies: readonly EngineId[];
  readonly supportsPreview: boolean;
  readonly supportsPersistence: boolean;
  readonly supportsBatch: boolean;
  /** Required to be a positive number when `supportsBatch` is `true`; must be `null`
   * when `supportsBatch` is `false`. */
  readonly maxBatchSize: number | null;
  readonly supportedScopes: readonly ManifestScope[];
  readonly securityRequirement: SecurityRole;
  readonly observability: ManifestObservability;
}

/**
 * Recursively freezes a manifest (and its nested arrays/objects) so a reference obtained
 * from the runtime registry cannot be mutated by a caller. Manifests are plain
 * JSON-shaped data (no class instances, no functions), so a structural recursive freeze
 * is safe and complete.
 */
export function freezeManifest<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const key of Object.getOwnPropertyNames(value)) {
      freezeManifest((value as Record<string, unknown>)[key]);
    }
    Object.freeze(value);
  }
  return value;
}
