# Genesis Phase 1 — The Sentinel Intelligence Foundation

This directory documents an **architecture mission** (not a feature mission) executed against
`C:\LEOTECHSCAN\APP`, building directly on the stable baseline established by
`docs/genesis-phase-0/` (tag `genesis-baseline-v1`, commit `b78ff8f`). Its sole objective was to
create the single, official contract language every current and future Sentinel intelligence
engine — Risk, Opportunity, Confidence, Priority, Data Trust, Recommendation, Machine Learning,
Simulation, Forecast, Optimization, Executive AI — will use to communicate, **without
implementing any of those engines**.

Everything created by this mission lives under `services/intelligence/`. Nothing outside that
directory (and this documentation, and the new test files listed below) was touched. SQLite, the
database, existing APIs, Next.js, React, the current frontend, Geospatial Stage 1, existing
tests, existing services, and existing routes are all exactly as Genesis Phase 0 left them.

## Documents in this set

- `00_EXECUTIVE_SUMMARY.md` — what was built, why, and the one-line status.
- `01_CANONICAL_MODEL.md` — the sixteen canonical entities and the `BaseEntity` contract they
  share.
- `02_INTELLIGENCE_CONTRACTS.md` — the full contract map: how `contracts/`, `types/`, `context/`,
  `registry/`, `evidence/`, `recommendations/`, `scoring/`, `versioning/`, `errors/`, and
  `validation/` relate to each other.
- `03_SCORE_SPECIFICATION.md` — the `Score` contract, field by field, and why each field exists.
- `04_EVIDENCE_MODEL.md` — the `Evidence` and `DataProvenance` contracts.
- `05_ENGINE_REGISTRY.md` — how engines are declared, and why declaration is deliberately
  separated from instantiation.
- `06_VERSIONING.md` — the semantic version contracts and the compatibility rules built on top of
  them.
- `07_CONTEXT.md` — the `CalculationContext` every engine receives, and why it replaces arbitrary
  parameter lists.
- `08_ERROR_MODEL.md` — the typed error hierarchy and why string errors were rejected.
- `09_IMPLEMENTATION_GUIDE.md` — how a Genesis Phase 2 engine is expected to consume this
  foundation.
- `10_FUTURE_ROADMAP.md` — what Genesis Phase 2 and beyond are expected to build on top of this,
  and what this phase deliberately left undecided.

## One-line status

`services/intelligence/` is a complete, self-contained, dependency-free TypeScript contract
library: sixteen canonical entities, the Score/Evidence/Recommendation/CalculationContext/
Provenance models, an engine registry, semantic versioning with compatibility checks, a typed
error hierarchy, and structural validation helpers — all covered by automated tests under
`tests/intelligence-*.test.ts`. No business logic, no persistence, no framework dependency, and no
existing file was modified. See `00_EXECUTIVE_SUMMARY.md` for the verified build/typecheck/test
results and `09_REMAINING_RISKS`-equivalent notes in `10_FUTURE_ROADMAP.md`.
