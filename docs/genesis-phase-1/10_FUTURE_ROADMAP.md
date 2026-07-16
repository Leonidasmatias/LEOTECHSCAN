# 10 — Future Roadmap and Open Questions

Genesis Phase 1 built the language. It deliberately did not decide everything downstream of that
language. This document records what is intentionally left open, so Genesis Phase 2 starts from
an accurate picture rather than rediscovering these questions mid-implementation.

## What Genesis Phase 2 (and beyond) is expected to build

- **Risk Engine, Opportunity Engine, Confidence Engine, Priority Engine, Data Trust Engine** —
  each consumes `CalculationContext`, produces `Score` values, declares itself in
  `EngineRegistry`, and cites `Evidence` for its drivers.
- **Recommendation Engine** — consumes `Score` values from other engines (by reference) and
  produces `Recommendation` values.
- **Machine Learning, Simulation, Forecast, Optimization, Executive AI** — each is a declared,
  planned engine id in `registry/engine-identity.ts` today, with no assumptions yet made about
  what internal technique (a trained model, a Monte Carlo simulation, an LLM-backed summarizer)
  it will use. This foundation only requires that whatever they build still emits `Score` and/or
  `Recommendation` values.

## Explicitly open questions this phase did not answer

- **Where does an `EngineRegistry` instance live at runtime?** A module-level singleton,
  something wired through dependency injection, one instance per request — this phase provides
  the class; where it is instantiated in a running application is a Genesis Phase 2 decision.
- **How are ids actually generated?** `toIdentifier` (validation/validators.ts) brands an
  already-existing string; it does not generate one. Whether ids come from the existing database's
  primary keys, a new UUID scheme, or something else entirely is unresolved on purpose — this
  phase does not touch persistence.
- **How is compatibility enforced in practice?** `isVersionCompatible`
  (`versioning/compatibility.ts`) is available to call; nothing in this phase wires it into a CI
  gate, a startup check, or a runtime guard. That wiring is a deployment/process decision for a
  later phase.
- **Where do canonical entities (Site, Municipality, ...) get populated from?** This phase defines
  what a `Site` reference looks like; it does not decide how one gets constructed from
  `core/site.ts`'s existing row data or `sentinel-core`'s existing graph. An adapter layer bridging
  the existing domain data into these canonical contracts is future work, not yet built.
- **Does `Evidence`/`Score`/`Recommendation` ever get persisted?** Genesis Phase 1 defines them as
  pure in-memory contracts. Whether and how they are stored (a new SQLite table, an external
  store, nothing at all beyond the in-memory result of a single request) is explicitly out of
  scope here and unresolved.

## Suggested order for Genesis Phase 2

1. Build the adapter layer that turns existing `core/`/`sentinel-core/` data into
   `services/intelligence` canonical entity references, without modifying either.
2. Implement the Data Trust Engine first — it has the most direct existing signal (the trust
   scores already computed elsewhere in the repository) and exercises `Score`, `Evidence`, and
   `EngineRegistry` end-to-end with the least new business logic.
3. Implement the Recommendation Engine second, once at least one Score-producing engine exists to
   react to.
4. Decide the registry-instantiation and persistence questions above once there is a second
   concrete engine to validate the decision against — deciding them against only one engine risks
   over-fitting the decision to that engine's needs.

## Risks carried forward

- **No engine has consumed this foundation yet.** Every contract here has been validated
  structurally (see the test suite) and by literal, type-checked sample construction in tests, but
  not by a real engine's actual output. The first real integration may surface a field this phase
  did not anticipate — the versioning model (`06_VERSIONING.md`) exists specifically so that can
  happen without breaking existing consumers.
- **The device bridge used to build this repository has a known, pre-existing limitation**: git
  operations that need to replace `.git/index.lock` cannot always complete cleanly in this
  environment (see the Compatibility Analysis in the final mission report). This is an environment
  characteristic, not a defect in anything built here, but it is worth knowing before assuming a
  clean `git status` proves nothing changed.
