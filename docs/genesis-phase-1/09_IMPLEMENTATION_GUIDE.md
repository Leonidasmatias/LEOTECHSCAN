# 09 — Implementation Guide (for Genesis Phase 2 and beyond)

This document is written for whoever implements the first real engine on top of this foundation.
It describes the expected shape of that work — not as a mandate on *how* to compute a risk score
or a recommendation, but as a checklist for staying inside the contracts this phase built.

## 1. Import from the top-level barrel

```ts
import {
  type Score,
  type Evidence,
  type Recommendation,
  type CalculationContext,
  EngineRegistry,
  toIdentifier,
  validateScoreShape,
  assertValid,
} from "@/services/intelligence";
```

Reach into a subdirectory (`@/services/intelligence/scoring/score`) only if a specific type is not
re-exported from the top level — it should be, for everything documented here.

## 2. Declare the engine before implementing it

```ts
const registry = new EngineRegistry();
registry.declare({
  id: "risk",
  name: "Risk Engine",
  description: "Produces risk scores for sites based on coverage, trust, and geospatial signals.",
  status: "active",
  version: {
    engineVersion: { major: 1, minor: 0, patch: 0, prerelease: null, build: null },
    contractVersion: { major: 1, minor: 0, patch: 0, prerelease: null, build: null },
    minimumCompatibleVersion: { major: 1, minor: 0, patch: 0, prerelease: null, build: null },
    deprecatedSince: null,
    breakingChanges: [],
  },
  capabilities: ["risk score"],
  owner: "Genesis Phase 2",
});
```

`EngineRegistry` is intentionally a plain class with no global singleton baked in — where the
registry instance lives (a module-level singleton, a dependency-injected service, one per
request) is an application-wiring decision for the phase that adds it, not something this
foundation prescribes.

## 3. Accept exactly one `CalculationContext`

An engine's public entry point should have the shape `execute(context: CalculationContext): ...` —
never `execute(entityId, options, flags)`. Everything the engine needs beyond what
`CalculationContext` already provides belongs in `context.extensions`, agreed upon between the
engine and its callers.

## 4. Produce `Score` and/or `Recommendation` values, never a bespoke shape

Whatever internal calculation an engine performs, its *output* — the thing another engine, a UI,
or an audit log will consume — must satisfy `Score` (`03_SCORE_SPECIFICATION.md`) or
`Recommendation` (see `02_INTELLIGENCE_CONTRACTS.md`). Attach evidence by reference
(`EvidenceId`), not by embedding: create or look up `Evidence` records separately, and cite their
ids.

## 5. Validate at the boundary, not internally

`validateScoreShape`, `validateEvidenceShape`, `validateRecommendationShape`, and
`validateCalculationContextShape` (`validation/validators.ts`) exist for *boundaries* — an
incoming API payload, a value deserialized from storage, output from a different engine you did
not write. Values your own engine constructs directly, with TypeScript checking every field at
compile time, do not need to be re-validated against themselves. Use `assertValid(contractName,
result)` to convert a failed check into a typed `ContractValidationError` in one call.

## 6. Version deliberately

Bump `engineVersion` when your calculation changes. Bump `contractVersion` only if the *shape* of
what you emit changes, and record a `BreakingChangeNote` (`06_VERSIONING.md`) when it does. Do not
bump both together out of habit — that is exactly the coupling `06_VERSIONING.md` explains why
this foundation avoids.

## 7. Do not modify `services/intelligence/` casually

Every file here is documented with *why* it exists. If an engine's real requirements genuinely
do not fit an existing contract, that is a signal to extend the contract deliberately (a new
optional field, a new documented breaking change) — not to route around it with a parallel,
undocumented shape.
