# 06 — Versioning

`services/intelligence/versioning/version.ts` and
`services/intelligence/versioning/compatibility.ts` define the official versioning contracts.

## Why versioning is a contract, not a convention

"Immutable contracts, versioned models" is a stated architectural principle of this phase. A
version that is just a loose string ("1.10.0") is unversioned in practice: nothing stops it from
sorting incorrectly against "1.9.0" as plain text, and nothing stops two engines from disagreeing
about what "compatible" means. `SemanticVersion` is the structured form; the pure functions in
`compatibility.ts` are the one place "is this compatible" gets decided, so every engine and every
consumer answers that question identically.

## `SemanticVersion`

A parsed `MAJOR.MINOR.PATCH[-prerelease][+build]` value (per semver.org), with four fields:
`major`, `minor`, `patch` (numbers), `prerelease` (string or `null`), and `build` (string or
`null`). `parseSemanticVersion` produces one from a raw string, returning `null` — not throwing —
for malformed input, so a validation boundary (`validation/validators.ts`) decides how to react
rather than this module deciding for it. `formatSemanticVersion` is its exact inverse.

## Why `engineVersion` and `contractVersion` are separate

`EngineVersionInfo` (used by `Score`, `Recommendation`, and `EngineDeclaration`) tracks two
independent version numbers:

- `engineVersion` — the version of the engine's *implementation*. It changes when the underlying
  model, calculation, or logic changes.
- `contractVersion` — the version of the *contract shape* the engine's output conforms to. It
  changes only when `Score`, `Recommendation`, or another shared contract's shape changes.

Conflating the two would force a contract version bump every time any engine fixes a bug or
retrains a model — defeating the point of having contracts stable enough for other engines to
build against. Keeping them separate means an engine can evolve constantly while the language it
speaks stays put, and vice versa: this foundation's contracts can gain new optional fields without
every engine needing a version bump.

## `minimumCompatibleVersion`, `deprecatedSince`, `breakingChanges`

- `minimumCompatibleVersion` — the oldest contract version a consumer must support to safely read
  this engine's output. `isVersionCompatible(candidate, minimum)` checks a candidate against it:
  compatible requires the same major version (a major bump signals a breaking change, per semver)
  and a version at or above the minimum.
- `deprecatedSince` — `null` while an engine's contract shape is current; set to the contract
  version at which it was deprecated, once it is.
- `breakingChanges` — every documented breaking change in an engine's contract history, as
  structured `BreakingChangeNote` records (`version`, `summary`, `migrationNotes`) rather than
  prose in a CHANGELOG, so tooling and future engines can enumerate them programmatically.

## What is explicitly not decided here

This phase does not decide *how* Genesis Phase 2 will publish version bumps, run compatibility
checks automatically in CI, or gate deployments on `isVersionCompatible`. It provides the
structural building blocks (a parseable version, a comparison function, a compatibility check) —
the process built on top of them is a future-phase decision, noted in `10_FUTURE_ROADMAP.md`.
