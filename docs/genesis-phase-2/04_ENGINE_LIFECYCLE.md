# 04 — Engine Lifecycle (Genesis Phase 2)

## Lifecycle states

```
declared → registered → initialized → ready ⇄ degraded
                                        │
                                        ▼
                                    executing → completed
                                        │            │
                                        ▼            ▼
                                     failed      (back to ready)
                                        │
                          disabled → deprecated → retired
```

- **declared** — an `EngineDeclaration` object exists (per `services/intelligence/registry/engine-registry.ts`'s own model) but has not been passed to `EngineRegistry.declare()`. This is the state every engine document/manifest describes before runtime wiring.
- **registered** — `EngineRegistry.declare()` has been called; `EngineRegistry.has(id)` returns true. Per Phase 1's own design, registration never instantiates the engine — a registered engine may still have no working implementation behind it (this is exactly the state all eleven canonical engine ids are in today, per `docs/genesis-phase-1/00_EXECUTIVE_SUMMARY.md`: declared as concepts, zero implemented).
- **initialized** — the engine's adapter module has loaded successfully (config parsed, dependencies resolvable) but has not yet served a real request.
- **ready** — the engine has passed its manifest's declared health check (`07_ENGINE_MANIFEST.md`) and may accept `CalculationContext` executions.
- **degraded** — the engine is reachable but a declared dependency is unhealthy (e.g. Data Trust's adapter is `ready` but Confidence's underlying legacy engine is erroring) — per Principle 10, this state is only reachable because dependencies are explicit; an engine with hidden dependencies cannot honestly report `degraded`.
- **executing** — a specific `ExecutionMetadata`-tracked run is in progress.
- **completed** — the most recent execution finished and produced a valid `Score`/`Recommendation` (validated via `validateScoreShape`/`validateRecommendationShape` at the boundary, per Principle 7).
- **failed** — the most recent execution raised an `IntelligenceError` or otherwise did not produce a valid canonical result. Per Principle 5, failure must never be silently swallowed into a default value (this directly targets the "unknown vs. zero" rule in `02_CANONICAL_DOMAIN_MODEL.md`).
- **disabled** — an operator/admin has explicitly turned the engine off (maps to `capabilities.json`'s existing `"unavailable"`/`"disabled"` status vocabulary).
- **deprecated** — the engine still runs but is marked for retirement; see `13_MIGRATION_STRATEGY.md` for the deprecation-criteria gate.
- **retired** — the engine no longer executes; its manifest remains for historical/audit purposes but `EngineRegistry.get()` returns `status: "deprecated"` per the existing `ENGINE_DECLARATION_STATUSES` closed union (`"planned" | "active" | "deprecated"` — note this union does not currently distinguish `disabled` from `deprecated` from `retired`; **Phase 2.0 does not modify `services/intelligence/registry/engine-identity.ts`'s closed union** per Principle 13, but records here that a future increment may need to extend it with a documented breaking change if these finer states prove necessary in practice, rather than silently reusing `"deprecated"` for three different meanings).

## Versioning axes (four, kept independent per `docs/genesis-phase-1/09_IMPLEMENTATION_GUIDE.md`'s own rule against bumping them together out of habit)

1. **Engine identity** — `EngineId` (e.g. `"data-trust"`), stable for the engine's lifetime.
2. **Semantic (engine) version** — bumped when the *calculation* changes (e.g. Data Trust's weight externalization, `01_ARCHITECTURE_PRINCIPLES.md` Principle 2's exception, would bump `engineVersion`, not `contractVersion`).
3. **Contract version** — bumped only when the *shape* of what the engine emits changes (per `services/intelligence/versioning/version.ts`'s existing model) — e.g. adding a new required `Score` field.
4. **Configuration version** — **new axis this document introduces**, not present in Phase 1's `EngineVersionInfo`. Tracks changes to the engine's `config/*.json` inputs (weights, thresholds) independently of code changes — necessary because Principle 2's weight-externalization work means a config-only edit (no code change) can change output, and that must be traceable the same way a code change is (Principle 8).
5. *(Implicit fifth axis, not separately versioned, but declared per Principle 10):* **dependency version** — which version of each declared dependency (another engine, a config file) this engine was built/tested against. Recorded in the manifest (`07_ENGINE_MANIFEST.md`'s `dependencies` field), not a separate semver of its own.

## Compatibility rules

- A `Score`/`Recommendation` consumer must check `contractVersion` via `isVersionCompatible()` (`services/intelligence/versioning/compatibility.ts`) before assuming field presence — this rule already exists in Phase 1; Phase 2.0 adds no new compatibility mechanism, only requires that new adapters actually call it (today, nothing does — Section 5, pre-implementation audit).
- `engineVersion` bumps are **not required** to be backward-compatible in output *value* (a recalculated Trust Score is expected to differ after a formula fix) but **are required** to remain contract-compatible in *shape* unless `contractVersion` also bumps.
- Configuration-version bumps that change output value **should** (not must, since config-driven behavior change is sometimes intentional and immediate — e.g. an emergency threshold fix) be logged as a Domain Event (`ScoreRecalculationTriggered`-class event, `06_EVENT_MODEL.md`) so downstream consumers can distinguish "the world changed" from "our model of the world changed."

## Health, execution, and capability status — kept as three separate concepts

- **Execution status** — the per-run outcome (`completed`/`failed`), transient, tied to one `ExecutionMetadata`.
- **Health status** — the engine's current operability (`ready`/`degraded`/`disabled`), a standing state, checked at request time or by a health-check sweep (`11_OBSERVABILITY_MODEL.md`).
- **Capability status** — `config/capabilities.json`'s existing vocabulary (`operational`/`partial`/`simulated`/`unavailable`/`planned`/`disabled`) — a **user-facing** truth-claim, deliberately coarser than the engine's internal lifecycle state and updated more conservatively (Principle 16: an engine can be technically `ready` while its capability is still declared `"partial"` if, e.g., it only covers a sample of the dataset — exactly `sentinel_core`'s current honest self-description).

## When an engine may be considered production-ready

An engine may be marked `capability.status: "operational"` in `config/capabilities.json` **only when all of the following hold simultaneously** (this is the binding gate, cross-referenced by `16_QUALITY_GATES.md`):

1. Its manifest (`07_ENGINE_MANIFEST.md`) is complete and validated.
2. It has passed structural validation (`validateScoreShape`/etc.) against real, non-synthetic input at least once, recorded as evidence, not asserted from memory.
3. Its declared dependencies are all themselves `ready` or better (no engine may claim readiness while silently depending on a `degraded` one).
4. Its security boundary (`10_SECURITY_BOUNDARY.md`) is defined for every operation it exposes, even if enforcement (authentication) is not yet implemented — the *definition* must exist.
5. It supports the bounded/resumable execution requirement (Principle 15) if it operates at batch or full-dataset scope.
6. Its `config/capabilities.json` entry's `limitations` field accurately describes any remaining gap (matching the file's own existing, honest style — e.g. `sentinel_core`'s "cobre apenas uma amostra"). An engine is never marked `operational` with an empty or stale `limitations` field.
