import { RuntimeEngineRegistry } from "./runtime-engine-registry";
import { CANONICAL_ENGINE_MANIFESTS } from "./canonical-engine-manifests";

/**
 * The single owned `RuntimeEngineRegistry` instance
 * (`docs/genesis-phase-2/00_EXECUTIVE_SUMMARY.md` Q12: "A singleton in
 * services/intelligence-runtime/registry-instance.ts... Only manifest-declaring adapter
 * modules register into it at module load; no runtime/dynamic registration from
 * request-handling code.").
 *
 * Construction is deterministic and pure: `CANONICAL_ENGINE_MANIFESTS` is a fixed,
 * ordered array, each entry is registered in that exact order, and registration performs
 * no I/O — no database, no network, no Next.js, no legacy engine execution. Re-importing
 * this module never re-runs construction (standard ES module singleton semantics), so
 * repeated access never duplicates a declaration.
 */
function buildRuntimeEngineRegistry(): RuntimeEngineRegistry {
  const registry = new RuntimeEngineRegistry();
  for (const manifest of CANONICAL_ENGINE_MANIFESTS) {
    registry.register(manifest);
  }
  return registry;
}

export const runtimeEngineRegistry: RuntimeEngineRegistry = buildRuntimeEngineRegistry();
