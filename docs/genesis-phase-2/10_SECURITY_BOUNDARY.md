# 10 — Security Boundary (Genesis Phase 2)

This document defines the security boundary. **It does not implement authentication.** It supports the pre-implementation audit's recommendation that authentication is Increment 0 of actual implementation, by giving that increment a concrete, pre-agreed role model to build against instead of a from-scratch design exercise.

## Operation classes

- **Public read:** no identity required. Reserved for operations that leak no per-record data and are already, by design, meant to be publicly checkable (`system-health`'s own header comment already states this explicitly).
- **Authenticated read:** requires a known identity, no specific privilege beyond "is a recognized user." Most read endpoints belong here once auth exists — they are not currently harmful to expose, but should not remain anonymous indefinitely given they expose per-Site business data.
- **Privileged recalculation:** requires a role beyond plain authentication — triggers writes and consumes compute (Section 15/16, pre-implementation audit).
- **Privileged export:** requires a role beyond plain authentication — writes files to disk, and PDF/CSV exports may contain data the organization considers sensitive even if individual field values are not secrets.
- **Administrative engine operation:** manifest changes, capability-registry edits, engine enable/disable — human-operator-only, not automatable by a regular authenticated user.
- **System-only batch operation:** scheduled/background full-dataset recalculation (`09_PERSISTENCE_AND_HISTORY.md`) — not reachable by any interactive user role at all, only by the system's own scheduler/service identity.

## Mapping every mandatory-scope operation to a class

| Operation | Class | Rationale |
|---|---|---|
| `GET /api/data-trust` (dashboard) | Authenticated read | Aggregate business data, not public-safe today |
| `POST /api/data-trust/recalculate` | Privileged recalculation | Unbounded-within-cap writes, per Section 16 |
| `GET /api/data-trust/site` | Authenticated read **for the read**, but see below | The route currently also writes (Section 9/16) — under this boundary model, the *read* is Authenticated read, but the *write* that currently rides along with it is Privileged recalculation-class and must not execute merely because a caller has Authenticated-read privilege. This is exactly why Principle 6/`13_MIGRATION_STRATEGY.md` must split this route's read and write behavior before authentication is meaningfully enforceable on it — you cannot correctly gate "GET" behind "authenticated read" when it secretly performs a "privileged recalculation" action. |
| `GET /api/data-quality` | Authenticated read | Dataset-wide, no persistence, still business-sensitive |
| `GET /api/duplicates` | Authenticated read | Same |
| `GET /api/evidence-center/site` | Authenticated read for the read; same split caveat as `data-trust/site` above | |
| `GET /api/evidence-center/export` | Privileged export | Writes a file, produces a shareable artifact |
| `GET /api/validation-history/site` | Authenticated read | Read-only today, genuinely fits this class cleanly |
| `POST /api/sentinel-core/build` | Privileged recalculation | Rebuilds the SIG graph, compute-intensive |
| `GET /api/sentinel-core/status` and read routes | Authenticated read | |
| `GET /api/audit-trail` | Authenticated read, arguably Administrative | The audit log is itself sensitive (reveals operational activity); recommend Administrative-only until a dedicated audit-viewer role is designed — a conservative default, revisit trigger below |
| `GET /api/system-health` | Public read (unchanged) | Already deliberately designed to leak nothing; the existing design decision to keep this public is endorsed, not revisited |
| `GET /api/export` (25 report types) | Privileged export | |
| Future `GET /api/intelligence/engines` (manifest listing, `07_ENGINE_MANIFEST.md`) | Authenticated read | Engine identity/version info is operational metadata, not a secret, but also not meant for anonymous scraping |
| Future engine manifest edits, capability-registry edits | Administrative engine operation | |
| Future scheduled full-dataset recalculation | System-only batch operation | |

## Minimum safeguards per named operation (mission Step 13 list)

- **Data-trust recalculation:** role check (Privileged recalculation) + existing `[1,5000]` clamp (keep) + a rate limit not currently present (e.g. N calls per identity per time window — mechanism TBD, not designed here) + idempotency protection (`09_PERSISTENCE_AND_HISTORY.md`'s idempotency-key concept, preventing a retried call from double-writing).
- **Evidence generation:** role check (Authenticated read for the read path; the persistence side-effect must first be split out per the table above) + audit requirement (already exists via `recordAudit`, keep).
- **Graph rebuild:** role check (Privileged recalculation) + a bound on `limit` (currently read from the request body with no confirmed upper clamp inside `app/api/sentinel-core/build/route.ts` itself — flagged unverified in the pre-implementation audit; this document requires the eventual fix to add an explicit clamp, mirroring Data Trust's `[1,5000]` pattern).
- **Exports:** role check (Privileged export) + the existing path-traversal (`lib/export-path.ts`) and CSV-injection (`utils/csv.ts`) mitigations (already correct, keep unchanged, per Principle 2's narrow-refactor-only stance).
- **Audit trail:** role check (Administrative, per the table above, pending a narrower role design) + the existing `limit=200` cap (keep).
- **System health:** unchanged — already correctly scoped as Public read with an explicit non-disclosure design.
- **Engine manifests:** role check (Authenticated read for listing; Administrative for any future edit endpoint) + `capabilityKey` consistency check (`16_QUALITY_GATES.md`) before any manifest claiming `"active"`/`"operational"` status is accepted.
- **Pipeline execution (new canonical endpoints):** role check per the individual engine manifest's `securityRequirement` field (`07_ENGINE_MANIFEST.md`) — the security boundary is therefore declared once per engine and enforced uniformly by the Orchestrator, not re-derived per route.

## Cross-cutting definitions

- **Authentication boundary:** not implemented in Phase 2.0. This document assumes *some* mechanism will establish a caller identity (a session, a token, a shared secret — mechanism choice deferred to the actual Increment 0 implementation) and defines everything else (roles, limits) in terms of "an authenticated caller," independent of the specific mechanism chosen.
- **Authorization roles:** the six operation classes above double as the initial role vocabulary — `public`, `authenticated`, `recalculation-privileged`, `export-privileged`, `admin`, `system`. A caller's role set determines which classes of operation they may invoke; this document does not design a full RBAC/ABAC model, only names the roles a minimal implementation needs to start with.
- **Request limits / batch limits:** per-engine, declared in the manifest (`maxBatchSize`), not duplicated as a separate security-layer concept — one source of truth.
- **Rate limiting:** **not designed in Phase 2.0** — named as a required future safeguard for Privileged-class operations (per the pre-implementation audit's Section 16 DoS finding) but the mechanism (token bucket, fixed window, etc.) is implementation-increment work, not architecture-freeze work.
- **Idempotency protection:** per `09_PERSISTENCE_AND_HISTORY.md`'s idempotency-key design.
- **Replay protection:** for privileged write operations once a real auth token exists, a nonce/timestamp check should prevent a captured request from being replayed — mechanism TBD, same status as rate limiting.
- **Audit requirements:** every Privileged-class and Administrative-class operation must produce an Audit Event (`06_EVENT_MODEL.md`) recording the acting identity once identity exists — today's `recordAudit` calls already log the *action*; once auth exists, they must also log *who*, which requires no schema change beyond adding an actor field to the existing `metadata_json` bag (a Phase-2-implementation-time, not Phase-2.0-schema-migration, change, since `metadata_json` is already schemaless).
- **Secret handling:** no secrets are read, stored, or referenced by this document. `copernicus_rules.json`'s own commentary already establishes that `COPERNICUS_ACCESS_TOKEN`/`COPERNICUS_CLIENT_ID` env vars, if ever configured, must never silently change data-authenticity claims (`services/copernicus-truth.ts`'s entire purpose) — this document extends that same discipline to any future auth secret: presence of a credential must never itself be treated as proof of anything (a direct generalization of a rule this codebase has already independently learned once).
- **Error disclosure policy:** every error response follows `system-health/route.ts`'s existing, correct pattern — never forward `error.message` or a stack trace to the client, log only a sanitized identifier server-side (`console.error("...", error instanceof Error ? error.name : "unknown")`, the exact pattern already in use). This is endorsed as the binding standard for every future route, not a new invention.

## Revisit trigger

This document's role model is intentionally minimal (six classes). Revisit if a future requirement needs per-Site or per-Operator scoped authorization (e.g. "Operator TIM's users may only see TIM sites") — nothing in the current repository or this mission's scope demonstrates that need yet (Principle 17).

## Enforcement status (added by Increment 0, `17_INCREMENT_0_SECURITY_FLOOR.md`)

Everything above remained a classification, not an enforcement, until Increment 0. Status as of that increment:

| Operation | Class | Enforced? |
|---|---|---|
| `POST /api/data-trust/recalculate` | Privileged recalculation | **Enforced** — `requireAdminAuth` (`lib/auth-guard.ts`), shared-secret header, fail-closed |
| `POST /api/sentinel-core/build` | Privileged recalculation | **Enforced** — same mechanism |
| `GET /api/data-trust/site` | Authenticated read / Privileged recalculation (split needed) | Still only classified — enforcing today would 401 a live UI read path (`components/DataTrustModules.tsx`); split-then-enforce deferred to Increment 11 per this document's own table above |
| `GET /api/evidence-center/site` | Authenticated read / Privileged recalculation (split needed) | Still only classified — same reason |
| `POST /api/sites/[id]/notes` | Not previously classified in this document | Still unenforced — inventoried in Increment 0's report, not in this increment's approved scope |
| Every other operation in the table above | As listed | Still only classified — unchanged by Increment 0, per its own minimal-footprint scope |
