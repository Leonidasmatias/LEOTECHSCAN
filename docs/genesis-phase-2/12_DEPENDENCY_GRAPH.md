# 12 — Dependency Graph (Genesis Phase 2)

## 1. Current-state graph (as directly confirmed by reading the source this session and the prior pre-implementation audit)

```
app/api/data-trust/site/route.ts ──┐
app/api/data-trust/recalculate/route.ts ──┤
app/api/data-trust/route.ts (dashboard) ──┴──► services/data-trust-engine.ts
                                                        │
                                                        ├──► api/site-query.ts (SITE_SELECT)
                                                        ├──► services/site-service.ts (siteRow)
                                                        ├──► services/confidence-engine.ts
                                                        │            │
                                                        │            └──► services/satellite-validation-engine.ts
                                                        │                       │
                                                        │                       └──► services/copernicus-engine.ts
                                                        │                                  │
                                                        │                                  ├──► config/copernicus_rules.json
                                                        │                                  └──► services/copernicus-truth.ts
                                                        └──► services/audit-trail.ts

app/api/evidence-center/site/route.ts ──┐
app/api/evidence-center/export/route.ts ──┴──► services/evidence-center-engine.ts
                                                        │
                                                        ├──► api/site-query.ts
                                                        ├──► services/site-service.ts
                                                        ├──► services/site-notes.ts
                                                        ├──► services/copernicus-engine.ts
                                                        ├──► services/data-trust-engine.ts  (full chain above, again)
                                                        └──► services/audit-trail.ts

app/api/data-quality/route.ts ──► services/data-quality-engine.ts ──► lib/db.ts (text())
app/api/duplicates/route.ts ──► services/duplicates-engine.ts ──► services/data-quality-engine.ts (normalizeAddress)
app/api/validation-history/site/route.ts ──► services/data-trust-engine.ts (validationHistory only)
app/api/sentinel-core/** ──► sentinel-core/engine.ts ──► sentinel-core/graph/*, inference/*, recommendation/*, knowledge/*
app/api/geospatial/** ──► services/geospatial/spatial-intelligence-engine.ts ──► services/geospatial/spatial-query-utils.ts, national-grid.ts
services/intelligence/**  (no incoming edges from any of the above — isolated, zero production consumers)
```

**Forbidden-in-target-but-currently-present edges, named explicitly (grandfathered per Principle 11, not to be extended):**
- `data-trust-engine.ts → confidence-engine.ts → satellite-validation-engine.ts → copernicus-engine.ts` (a four-deep direct-import chain, no orchestration).
- `evidence-center-engine.ts → data-trust-engine.ts` and `evidence-center-engine.ts → copernicus-engine.ts` (evidence depends on trust *and* independently on copernicus, duplicating part of trust's own dependency chain — a second path to the same data).
- `confidence-engine.ts`, `copernicus-engine.ts`, `data-quality-engine.ts` each independently re-implementing the Brazil-bounds check instead of importing `services/geospatial/brazil-bounds.ts` (Section 10, pre-implementation audit) — not a call-graph edge exactly, but a duplicated-logic dependency that *should* be an edge and isn't.

## 2. Target-state graph

```
Client
  │
  ▼
API layer (app/api/**)
  │  — existing routes: unchanged, still call legacy engines directly (Principle 4)
  │  — NEW canonical routes only:
  ▼
Application service / use case  (e.g. "get Site data-trust assessment")
  │
  ▼
IntelligenceOrchestrator (05_ORCHESTRATION_MODEL.md)
  │  — constructs CalculationContext, resolves dependency order, owns persistence policy
  ▼
Engine adapters (08_ADAPTER_STRATEGY.md, services/intelligence-adapters/**)
  │  — thin, DB-touching outer layer + pure inner translator
  ├──► Canonical engines/contracts (services/intelligence/**)   ◄── never imports anything below this line
  └──► Legacy engines (services/*-engine.ts)                     — wrapped, not modified (Principle 2)
              │
              ▼
       Persistence adapters (09_PERSISTENCE_AND_HISTORY.md — conceptual; not built in Phase 2.0)
              │
              ▼
            SQLite (lib/db.ts)
```

**Additional relationships, shown separately for clarity:**

- **Evidence relationships:** Score Adapters cite Evidence by `EvidenceId` reference (never embed) → Evidence Adapter is a peer dependency of every Score Adapter, not a child of it.
- **Recommendation relationships:** Recommendation Adapter depends on ≥1 Score Adapter's output (per `docs/genesis-phase-1/10_FUTURE_ROADMAP.md`'s own sequencing rule) and on the Evidence Adapter (citing evidence for its reasoning).
- **Rule/config dependencies:** every adapter/legacy engine that reads `config/*.json` does so directly (config is treated as a leaf dependency, not routed through the orchestrator) — config is data, not a service, and routing it through orchestration would be unjustified abstraction (Principle 17).
- **Provenance dependencies:** Evidence Adapter → `import_audit` (where traceable) and → `services/copernicus-truth.ts` (mandatory, for any Copernicus-sourced evidence — enforced, not optional, per the Data Source invariant in `02_CANONICAL_DOMAIN_MODEL.md`).
- **Security boundary:** sits between "API layer" and "Application service / use case" in the target graph — every request crossing that line must resolve to a role (`10_SECURITY_BOUNDARY.md`) before the use case executes, even though no enforcement exists yet in Phase 2.0.
- **Observability boundary:** wraps the Orchestrator and every Engine Adapter — every crossing of "Orchestrator → Engine adapters" emits `ExecutionMetadata` and, where applicable, a Domain Event (`06_EVENT_MODEL.md`); this is a cross-cutting wrap, not a graph node of its own.

## Forbidden target dependencies (binding, checked by `16_QUALITY_GATES.md`)

1. `services/intelligence/**` importing anything from `services/*-engine.ts`, `sentinel-core/**`, `lib/db.ts`, or `node:sqlite`, directly or transitively.
2. Any new Engine Adapter (`services/intelligence-adapters/**`) importing `next/server` or any Next.js-specific type, except the API Projection Adapter category specifically (`08_ADAPTER_STRATEGY.md`).
3. Any new canonical route (`app/api/intelligence/**`, once it exists) calling a legacy engine directly, bypassing the Orchestrator — this is the specific rule that keeps new code from re-creating the "hidden direct dependency" pattern the current legacy chain already has.
4. Any Score/Evidence/Recommendation Adapter introducing a new business formula (restates `08_ADAPTER_STRATEGY.md`'s core rule as a graph-level constraint: no new "computation" nodes may exist inside the adapter layer).
5. Two adapters independently reaching into the same legacy engine's internals in incompatible ways (e.g. two different Score Adapters both hand-rolling their own trust-score-to-canonical-scale conversion) — there must be exactly one conversion function per legacy engine, reused by every adapter that needs it.
