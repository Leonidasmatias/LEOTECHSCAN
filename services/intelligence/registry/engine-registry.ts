import type { EngineId, EngineDeclarationStatus } from "./engine-identity";
import type { EngineVersionInfo } from "../versioning/version";
import { DuplicateEngineDeclarationError, EngineNotRegisteredError } from "../errors/intelligence-error";

/**
 * A declaration of an intelligence engine's identity, without any of the
 * engine's implementation.
 *
 * WHY A "DECLARATION" AND NOT AN "ENGINE"
 * ---------------------------------------------------------------------------
 * The mission is explicit: "The registry must not instantiate engines. Only
 * declare them." A declaration is metadata *about* an engine — what it is
 * called, what it produces, what version it is at, whether it exists yet —
 * kept completely separate from any executable code. This is what lets
 * Genesis Phase 1 stand up the registry for Risk, Opportunity, Confidence,
 * Priority, Data Trust, Recommendation, Machine Learning, Simulation,
 * Forecast, Optimization, and Executive AI *before* any of them are
 * implemented: the registry only needs to know these engines exist as
 * concepts, not how to run them.
 */
export interface EngineDeclaration {
  readonly id: EngineId;

  /** Human-readable engine name (e.g. "Risk Engine"). */
  readonly name: string;

  /** Human-readable description of what this engine is intended to
   * produce. */
  readonly description: string;

  /** Lifecycle state of this declaration. Every engine declared during
   * Genesis Phase 1 is `"planned"` — none are implemented in this phase. */
  readonly status: EngineDeclarationStatus;

  /** Version information for this engine. For a `"planned"` engine, this
   * records the version the engine is *intended* to launch at. */
  readonly version: EngineVersionInfo;

  /** What kinds of Score/Recommendation output this engine is declared to
   * produce (e.g. "risk score", "site recommendation"). Purely
   * descriptive — the registry does not enforce that a future
   * implementation actually produces these. */
  readonly capabilities: readonly string[];

  /** The team, module, or phase responsible for eventually implementing
   * this engine (e.g. "Genesis Phase 2"). */
  readonly owner: string;
}

/**
 * The official engine registry.
 *
 * An in-memory, side-effect-free catalog of engine declarations. It has no
 * knowledge of how to run an engine, no dependency on any specific engine's
 * implementation, and no framework or infrastructure dependency — adding an
 * engine to this registry never requires touching an existing engine's
 * code, and vice versa.
 */
export class EngineRegistry {
  private readonly declarations = new Map<EngineId, EngineDeclaration>();

  /**
   * Declares an engine. Throws {@link DuplicateEngineDeclarationError} if an
   * engine with the same id has already been declared — declarations are
   * meant to be registered once, at startup, not silently overwritten.
   */
  public declare(declaration: EngineDeclaration): void {
    if (this.declarations.has(declaration.id)) {
      throw new DuplicateEngineDeclarationError(declaration.id);
    }
    this.declarations.set(declaration.id, declaration);
  }

  /**
   * Looks up a declared engine by id. Throws
   * {@link EngineNotRegisteredError} if no engine with that id has been
   * declared.
   */
  public get(id: EngineId): EngineDeclaration {
    const declaration = this.declarations.get(id);
    if (!declaration) {
      throw new EngineNotRegisteredError(id);
    }
    return declaration;
  }

  /** Whether an engine with the given id has been declared. */
  public has(id: EngineId): boolean {
    return this.declarations.has(id);
  }

  /** Every declared engine, in declaration order. */
  public list(): readonly EngineDeclaration[] {
    return Array.from(this.declarations.values());
  }

  /** Every declared engine with the given lifecycle status. */
  public listByStatus(
    status: EngineDeclarationStatus,
  ): readonly EngineDeclaration[] {
    return this.list().filter((declaration) => declaration.status === status);
  }
}
