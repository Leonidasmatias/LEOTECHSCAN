# 08 — Error Model

`services/intelligence/errors/intelligence-error.ts` and
`services/intelligence/errors/error-codes.ts` define the official typed error hierarchy.

## Why string errors and ad-hoc exceptions were rejected

`throw new Error("engine not found")` cannot be caught selectively (a `catch` block can only
inspect a message string, which is fragile to even cosmetic wording changes), carries no
structured detail a caller could act on, and gives every catch site exactly the same amount of
information: none. The mission is explicit that this foundation must reject that pattern
entirely: "No string errors. No ad-hoc exceptions. Create typed contracts." Every failure mode in
`services/intelligence` is a typed subclass of `IntelligenceError`, each carrying a closed `code`
a caller can `switch` on and a `details` object with whatever structured context is relevant to
that specific failure.

## `IntelligenceError`

The abstract base class every error in this foundation extends. It guarantees two things every
subclass must provide:

- `code` — one of the closed set in `IntelligenceErrorCode` (`error-codes.ts`).
- `details` — a `Metadata` bag (JSON-serializable), so an error can be logged, serialized across
  a process boundary, or displayed, without losing structure to a flattened message string.

## Why error codes are a closed set, unlike engine ids or score types

`EngineId` and `ScoreType` are open-ended because adding a new engine or a new kind of score is
exactly the kind of routine extension future phases are expected to make. Error codes describe a
fixed set of *structural* failure modes in the foundation itself — contract violations, version
incompatibilities, registry misuse, evidence integrity failures, unknown entity references. Adding
a new one is a considered change to what "wrong" means in this system, not a routine addition, so
it is a closed union (`INTELLIGENCE_ERROR_CODES`) that must be edited — visibly, in a diff — to
add a new failure mode.

## The six error types

| Class | Code | Raised when |
|---|---|---|
| `ContractValidationError` | `CONTRACT_VALIDATION_FAILED` | A value fails a structural check in `validation/validators.ts`. |
| `VersionIncompatibilityError` | `VERSION_INCOMPATIBLE` | A candidate version fails `isVersionCompatible` against a declared minimum. |
| `EngineNotRegisteredError` | `ENGINE_NOT_REGISTERED` | `EngineRegistry.get()` is called with an id that was never declared. |
| `DuplicateEngineDeclarationError` | `DUPLICATE_ENGINE_DECLARATION` | `EngineRegistry.declare()` is called twice with the same id. |
| `EvidenceIntegrityError` | `EVIDENCE_INTEGRITY_FAILED` | A piece of evidence's checksum does not match its recorded provenance. |
| `UnknownEntityReferenceError` | `UNKNOWN_ENTITY_REFERENCE` | An `EntityReference.kind` is not one of the sixteen canonical entity kinds. |

## What this model does not cover

These errors describe failures *of the contracts themselves* — a malformed Score, a duplicate
engine declaration, an incompatible version. They do not, and are not meant to, describe business
failures a future engine might encounter (e.g. "risk calculation could not converge") — those
belong to that engine's own error handling, which may itself choose to extend
`IntelligenceError` in a later phase, but that decision is deliberately left open rather than
made here.
