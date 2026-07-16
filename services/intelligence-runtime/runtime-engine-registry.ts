import {
  EngineRegistry,
  EngineNotRegisteredError,
  ContractValidationError,
  type EngineId,
  type EngineDeclarationStatus,
} from "@/services/intelligence";
import type { EngineManifest } from "./engine-manifest";
import { freezeManifest } from "./engine-manifest";
import { validateEngineManifestShape } from "./engine-manifest-validation";

/**
 * The runtime boundary around Phase 1's canonical `EngineRegistry`
 * (`services/intelligence/registry/engine-registry.ts`).
 *
 * This class does not replace `EngineRegistry` — it composes around it (Step 3.3:
 * "Prefer composition around EngineRegistry, not replacement"). Every duplicate-id and
 * not-found behavior below is `EngineRegistry`'s own existing, already-tested behavior
 * (`DuplicateEngineDeclarationError` / `EngineNotRegisteredError`); this class only adds
 * manifest-shape validation and dependency-ordering checks before delegating to it, and
 * narrows its interface to `EngineManifest`-typed, read-only access.
 *
 * Guarantees:
 *  - never instantiates or executes a legacy engine;
 *  - never opens SQLite;
 *  - never imports Next.js;
 *  - never persists state (in-memory only, for the process lifetime);
 *  - the only mutation entry point is `register()`, and it is idempotency-guarded by the
 *    underlying registry's own duplicate-id rejection — there is no `update`/`unregister`
 *    method, so a caller holding a reference to this class cannot silently overwrite a
 *    prior declaration;
 *  - `register()` requires every declared dependency id to already be registered, which
 *    makes a dependency cycle structurally impossible to construct (you cannot register
 *    A-depends-on-B before B exists, so a cycle A→B→A can never both sides be declared).
 */
export class RuntimeEngineRegistry {
  private readonly registry = new EngineRegistry();

  /**
   * Validates `manifest`'s shape, verifies every declared dependency id is already
   * registered, freezes the manifest, then declares it into the underlying
   * `EngineRegistry`. Throws {@link ContractValidationError} on a malformed manifest,
   * {@link EngineNotRegisteredError} if a declared dependency is not yet registered, and
   * the underlying registry's own `DuplicateEngineDeclarationError` on a repeated id.
   */
  public register(manifest: EngineManifest): void {
    const result = validateEngineManifestShape(manifest);
    if (!result.valid) {
      throw new ContractValidationError(
        `EngineManifest:${String((manifest as { id?: unknown }).id ?? "unknown")}`,
        result.issues.map((issueItem) => `${issueItem.path}: ${issueItem.message}`),
      );
    }
    for (const dependencyId of manifest.dependencies) {
      if (!this.registry.has(dependencyId)) {
        throw new EngineNotRegisteredError(dependencyId);
      }
    }
    this.registry.declare(freezeManifest(manifest));
  }

  /** Looks up a registered manifest by id. Throws {@link EngineNotRegisteredError} if no
   * engine with that id has been registered — the same typed error `EngineRegistry.get`
   * already raises. */
  public getManifest(id: EngineId): EngineManifest {
    return this.registry.get(id) as EngineManifest;
  }

  /** Whether an engine with the given id has been registered. */
  public hasManifest(id: EngineId): boolean {
    return this.registry.has(id);
  }

  /** Every registered manifest, in registration order (the order `register()` was
   * called — deterministic for a given call sequence). */
  public listManifests(): readonly EngineManifest[] {
    return this.registry.list() as readonly EngineManifest[];
  }

  /** Every registered manifest with the given lifecycle status. */
  public listManifestsByStatus(status: EngineDeclarationStatus): readonly EngineManifest[] {
    return this.registry.listByStatus(status) as readonly EngineManifest[];
  }
}
