/**
 * Public entry point for the Genesis Phase 2 Increment 2 engine-manifest / runtime-registry
 * infrastructure. Nothing in this module — or anything it exports — opens a database,
 * imports Next.js, or executes a legacy engine. See
 * docs/genesis-phase-2/18_INCREMENT_2_ENGINE_MANIFEST_REGISTRY.md for the full rationale.
 */

export type {
  EngineManifest,
  ManifestPort,
  ManifestObservability,
  SecurityRole,
  HealthCheckKind,
  ManifestScope,
} from "./engine-manifest";
export {
  SECURITY_ROLES,
  HEALTH_CHECK_KINDS,
  MANIFEST_SCOPES,
  freezeManifest,
} from "./engine-manifest";

export { validateEngineManifestShape } from "./engine-manifest-validation";

export { RuntimeEngineRegistry } from "./runtime-engine-registry";

export { CANONICAL_ENGINE_MANIFESTS } from "./canonical-engine-manifests";

export { runtimeEngineRegistry } from "./registry-instance";
