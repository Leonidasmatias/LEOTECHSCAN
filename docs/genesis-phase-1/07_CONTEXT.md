# 07 — Calculation Context

`services/intelligence/context/calculation-context.ts` defines the official
`CalculationContext` contract.

## Why exactly one context object, and not a parameter list

The mission is explicit: "Every intelligence engine shall receive exactly one execution context.
No arbitrary parameters." Arbitrary parameter lists are how engines quietly diverge from each
other — one engine's entry point takes `(entityId, options)`, another takes
`(scope, flags, snapshotId)`, a third adds a fourth positional argument eight months later. Once
that happens, nothing can orchestrate or compose engines uniformly: a scheduler that wants to run
"every declared engine against this site" needs to know each engine's individual calling
convention. `CalculationContext` is the one object every engine's entry point is expected to
accept instead. An engine that needs information not already on this contract extends
`extensions`, rather than adding a second parameter — the shape of "how do you call an engine"
never changes, no matter how many engines exist.

## Field-by-field

| Field | Type | Why it exists |
|---|---|---|
| `contextId` | `string` | Uniquely identifies this specific execution, so a produced `Score.executionMetadata.contextId` or `Recommendation`'s execution trail can be correlated back to the context that produced it. |
| `scope` | `EntityReference \| "global"` | What this execution is being asked to evaluate — a specific entity, or the literal string `"global"` for system-wide runs (e.g. "recompute Data Trust for every site" vs. "recompute Data Trust for site X"). |
| `snapshot` | `SnapshotId` | The data snapshot this execution must operate against, so results are reproducible against a fixed point in time rather than "whatever the data happens to be right now." |
| `requestedAt` | `IsoDateTime` | When this execution was requested. |
| `requestedBy` | `string` | Who or what requested it (e.g. `"user:leonidas"`, `"engine:risk"`, `"scheduler:nightly-batch"`). Left as free text because requesters are not limited to end users — one engine invoking another, or a scheduled batch job, are equally legitimate requesters. |
| `correlationId` | `string` | Correlates this execution with a broader request or trace — e.g. a single user action that triggers several engines in sequence — distinct from `contextId`, which identifies only this one execution. |
| `environment` | `"production" \| "staging" \| "test" \| "sandbox"` | Lets an engine adjust behavior appropriately (e.g. stricter validation in production) without inventing its own environment-detection mechanism. |
| `extensions` | `Metadata` | The forward-compatible extension point mentioned above — new context fields a future engine needs, before they warrant a typed field on this contract. |

## Relationship to `ExecutionMetadata`

`CalculationContext` describes *what an engine was asked to do, and under what conditions*, before
it runs. `ExecutionMetadata` (`contracts/execution-metadata.ts`), attached to every `Score` and
`Recommendation`, describes *what actually happened during a specific run* — which engine, how
long it took, and what non-fatal notes it emitted — and carries the originating context's
`contextId` so the two can always be joined back together. The two are deliberately separate
contracts: one is an input, the other an output, and conflating them would make it impossible to
tell "what we asked for" from "what we got."
