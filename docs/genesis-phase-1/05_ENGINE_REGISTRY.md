# 05 — Engine Registry

`services/intelligence/registry/engine-registry.ts` and
`services/intelligence/registry/engine-identity.ts` define the official engine registry.

## Why declaration and instantiation are strictly separated

The mission is explicit: "The registry must not instantiate engines. Only declare them." This
separation exists because Genesis Phase 1 needs to give every named engine — Risk, Opportunity,
Confidence, Priority, Data Trust, Recommendation, Machine Learning, Simulation, Forecast,
Optimization, Executive AI — an official identity, a version, a description, and a place in the
system, *before any of them have an implementation to instantiate*. An `EngineDeclaration` is pure
metadata: an id, a name, a description, a lifecycle status, version information, a list of
capabilities, and an owner. It contains no function, no class reference, and no way to actually
run the engine it describes. `EngineRegistry.declare()` stores this metadata; nothing in this
module ever calls, imports, or references an engine's executable code, because that code does not
exist yet in this phase.

## `EngineDeclaration` field-by-field

| Field | Type | Why it exists |
|---|---|---|
| `id` | `EngineId` (open string) | Canonical spelling for this engine (see `engine-identity.ts`). Open-ended so a future engine this phase did not anticipate can declare itself without a contract change. |
| `name` | `string` | Human-readable name. |
| `description` | `string` | What this engine is intended to produce. |
| `status` | `"planned" \| "active" \| "deprecated"` | Lifecycle state. Every engine declared during Genesis Phase 1 is `"planned"` — `"active"` is reserved for a future phase that actually ships an implementation. |
| `version` | `EngineVersionInfo` | See `06_VERSIONING.md`. For a `"planned"` engine, records the version the engine is *intended* to launch at. |
| `capabilities` | `readonly string[]` | Descriptive list of what kinds of Score/Recommendation output this engine is declared to produce. Purely informational — the registry does not enforce that an eventual implementation actually produces these. |
| `owner` | `string` | The team, module, or phase responsible for eventually implementing this engine. |

## Why `EngineId` is open, but registry behavior is strict

`CANONICAL_ENGINE_IDS` (in `engine-identity.ts`) lists the eleven engines named in the mission
brief, giving each one a canonical, shared spelling that documentation, tests, and future
declarations can all reference identically. `EngineId` itself remains an open string type
(`CanonicalEngineId | (string & {})`) so a genuinely new engine can still declare itself. What is
*not* open is the registry's behavior once ids are in play: `declare()` throws
`DuplicateEngineDeclarationError` (`errors/intelligence-error.ts`) if the same id is declared
twice, and `get()` throws `EngineNotRegisteredError` if an id was never declared. Openness applies
to *what an engine may be called*; strictness applies to *how the registry behaves once it is
called that*.

## What Genesis Phase 2 does with this registry

A future phase implementing, say, the Risk Engine is expected to call
`EngineRegistry.declare()` once at startup with `status: "active"` and a real
`EngineVersionInfo`, then build its actual scoring logic entirely outside this module, emitting
`Score` values that satisfy the contract in `03_SCORE_SPECIFICATION.md`. The registry never needs
to change to support this — declaring an engine as active instead of planned is a data change, not
a contract change.
