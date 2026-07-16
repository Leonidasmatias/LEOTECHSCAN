# 07 — Engine Manifest (Genesis Phase 2)

## Decision: manifests live in code (TypeScript, type-checked), with JSON as a derived/exported artifact — never hand-authored JSON as the source of truth.

**Why not JSON-only:** `config/sentinel_rules.json`/`capabilities.json` already demonstrate the failure mode of hand-maintained JSON describing code behavior — the pre-implementation audit found `confidence-engine.ts`'s weights are *not* in `sentinel_rules.json` despite that being the obvious place, precisely because nothing forces code and config to stay in sync when the config is hand-edited prose-adjacent JSON rather than a typed, compiled artifact. A manifest is a stronger claim than a rule-weight (it describes an engine's contract-facing identity), so the sync risk is worse, not better.

**Why not code-only (no JSON at all):** `config/capabilities.json` is explicitly the interface-facing "single source of truth for what the LeoTechScan interface may claim" (its own header comment) and is consumed by `app/api/system-health/route.ts` at runtime without importing engine code directly. A pure-code manifest with no JSON projection would force `system-health` (and any future admin UI) to import every engine module just to summarize capability counts — coupling a lightweight status endpoint to the full engine dependency graph, which is both a performance and a blast-radius problem.

**Resolution:** each engine's manifest is authored as a typed TypeScript object (`EngineManifest`, extending/complementing `services/intelligence/registry/engine-identity.ts`'s existing `EngineDeclaration`), colocated with its adapter module. A build-time or registry-startup step serializes the registered manifests to JSON (e.g. exposed via a new `GET /api/intelligence/engines` route reading the live `EngineRegistry`, not a static file) — so the JSON is always a *projection* of the code, never edited independently. `config/capabilities.json` remains the separate, coarser, user-facing file (Principle 16) and is updated by a human/PR as part of `16_QUALITY_GATES.md`'s gate, cross-checked against the generated engine-manifest JSON for consistency, not replaced by it.

## Manifest shape (extends the mission's example, reconciled with `services/intelligence/registry/engine-identity.ts`'s existing `EngineDeclaration`)

```ts
interface EngineManifest extends EngineDeclaration {   // id, name, description, status, version, capabilities, owner — inherited, unchanged
  readonly engineVersion: SemVerString;                // restates EngineDeclaration.version.engineVersion for the mission's flat example shape
  readonly contractVersion: SemVerString;
  readonly configurationVersion: string;                 // NEW axis (04_ENGINE_LIFECYCLE.md) — not in Phase 1's EngineVersionInfo
  readonly capabilityKey: string;                         // links to a config/capabilities.json entry — REQUIRED, enforces Principle 16
  readonly inputs: readonly ManifestPort[];                // named, typed input ports this engine consumes
  readonly outputs: readonly ManifestPort[];                // named, typed output ports (Score/Evidence/Recommendation types produced)
  readonly dependencies: readonly EngineId[];               // REQUIRED, enforces Principle 10 — explicit, no hidden imports
  readonly supportsPreview: boolean;                         // may run with persist=false
  readonly supportsPersistence: boolean;                      // may run with persist=true
  readonly supportsBatch: boolean;
  readonly maxBatchSize: number | null;                        // null only if supportsBatch is false
  readonly supportedScopes: readonly ("site" | "municipality" | "state" | "global")[];
  readonly securityRequirement: SecurityRole;                    // from 10_SECURITY_BOUNDARY.md's role set — REQUIRED even though unenforced in Phase 2.0
  readonly observability: { readonly emitsEvents: readonly string[]; readonly healthCheck: "none" | "self" | "dependency-chain" };
}

interface ManifestPort { readonly name: string; readonly shape: string /* a services/intelligence contract name, e.g. "Score<data-trust>" */; readonly required: boolean; }
```

## Field requirements

**Required (manifest is invalid without these, checked at registry-declare time):** `id`, `name`, `description`, `status`, `engineVersion`, `contractVersion`, `configurationVersion`, `capabilityKey`, `dependencies` (may be an empty array, but must be present — an omitted field is a defect per Principle 10, an empty array is a legitimate "no dependencies" declaration), `supportsPreview`, `supportsPersistence`, `supportsBatch`, `securityRequirement`.

**Optional:** `owner`, `outputs[].required` (defaults true), `observability.emitsEvents` (defaults empty), `supportedScopes` (defaults `["site"]` if omitted, the most conservative/common case).

**Validation:** a new `validateEngineManifestShape()` function, following the exact pattern of `services/intelligence/validation/validators.ts`'s existing validators — structural only, not business-rule (consistent with that module's stated design boundary). This is new code, not a Phase 2.0 deliverable itself (documentation-only mission), but its required shape is frozen here so Increment 2 (`14_IMPLEMENTATION_ROADMAP.md`) can build it directly from this document.

## Lifecycle status linkage

`status` uses the existing closed `ENGINE_DECLARATION_STATUSES` union (`"planned" | "active" | "deprecated"`) — Phase 2.0 does not extend this union (Principle 13); where `04_ENGINE_LIFECYCLE.md`'s finer states (`disabled` vs. `deprecated` vs. `retired`) are needed, they are tracked in `capabilityKey`'s linked `capabilities.json` entry's `status` field (which already has a richer vocabulary: `operational`/`partial`/`simulated`/`unavailable`/`planned`), not by extending the engine-registry union — two separate, appropriately-scoped vocabularies, not one overloaded one.

## Dependency declarations

`dependencies: readonly EngineId[]` lists other **canonical, registered** engines this engine's adapter calls through the orchestrator. It does **not** list grandfathered direct legacy imports (Principle 11) — those remain implicit in the legacy code until the depended-upon engine itself gets an adapter, at which point the dependency becomes declarable and must be added to the manifest in the same increment that removes the direct import.

## Capability linkage

Every manifest's `capabilityKey` must resolve to an existing (or newly-added-in-the-same-PR) `config/capabilities.json` entry. `16_QUALITY_GATES.md` enforces this as a mechanical check (a script comparing registered manifests' `capabilityKey`s against `capabilities.json`'s `key`s), not a manual review step alone.

## Batch limits and scopes

`maxBatchSize` generalizes today's ad hoc per-endpoint caps (Data Trust's `min(5000, ...)`, geospatial's `MAX_BBOX_LIMIT`/`MAX_CLUSTER_CANDIDATES`) into one manifest-declared field every batch-capable engine must state, directly enforcing Principle 15.

## Security requirements

`securityRequirement` takes one value from `10_SECURITY_BOUNDARY.md`'s role set (`public-read | authenticated-read | privileged-recalculation | privileged-export | admin | system-only`). Declaring this in Phase 2.0, even though no enforcement mechanism exists yet, is what lets a future auth increment be a mechanical sweep ("wire middleware X to every manifest declaring role Y") instead of a case-by-case audit repeated from scratch (Principle 14).

## Observability requirements

`observability.emitsEvents` cross-references `06_EVENT_MODEL.md`'s candidate event list; `healthCheck` declares how `04_ENGINE_LIFECYCLE.md`'s `ready`/`degraded` distinction is computed for this engine (`"none"` is only valid for engines with no external dependency, e.g. a pure Coordinate Assessment wrapper).
