# 02 — Intelligence Contracts: The Full Map

## The eleven directories, and why each one exists

`services/intelligence/` is organized into eleven directories, matching the mandatory structure
in the mission brief. Each exists to answer one specific question a future engine author would
otherwise have to answer themselves, inconsistently, every time:

| Directory | Question it answers |
|---|---|
| `types/` | What are the shared primitives (ids, timestamps, versions, confidence numbers) every other contract is built from? |
| `contracts/` | What must *every* entity contain, and what small set of value objects (`Limitation`, `ExecutionMetadata`) does more than one contract need identically? |
| `entities/` | What are the canonical "nouns" of the system, and where does each one live? |
| `context/` | What single object does an engine receive instead of an arbitrary parameter list? |
| `registry/` | Where does an engine declare that it exists, without being instantiated? |
| `evidence/` | How does any engine justify its output, and how does that justification trace back to real data? |
| `recommendations/` | How does any engine say "and here is what to do about it"? |
| `scoring/` | How does any engine express a judgment — a number, a classification, a confidence, a trail of drivers? |
| `versioning/` | How do engine implementations and contract shapes evolve without breaking each other? |
| `errors/` | What happens, in a typed and catchable way, when any of the above is violated? |
| `validation/` | How does a caller check, at a runtime boundary, that an untyped value actually satisfies one of these contracts? |

## Dependency direction

The directories form a strict, acyclic dependency order (arrows mean "depends on"):

```
types  →  contracts  →  entities
                 ↘        ↓
                  evidence, scoring, recommendations, context
                                 ↓
                         registry, versioning
                                 ↓
                        errors  ←  validation
```

`types/` depends on nothing else in this module. `contracts/` depends only on `types/`.
`entities/`, `evidence/`, `scoring/`, `recommendations/`, and `context/` depend on `types/` and
`contracts/` but not on each other except where a domain relationship requires it (e.g.
`scoring/score.ts` references `EvidenceId` from `types/identifiers.ts`, never the full `Evidence`
interface, to avoid a hard dependency between the two directories). `registry/` and `versioning/`
sit above those. `errors/` depends only on `registry/engine-identity.ts` (for typing which engine
failed) and `types/`. `validation/` depends on `errors/` (to throw typed errors) and `entities/`
(to check recognized entity kinds). No directory imports from a directory "below" it in this
order, which is what keeps the dependency graph acyclic and each layer independently
understandable.

## No framework, no infrastructure

Every file in `services/intelligence/` imports only from other files within
`services/intelligence/` or from the TypeScript/JavaScript standard library. None imports React,
Next.js, `node:sqlite`, or any existing service in this repository. This is not an accident of
what happened to be convenient — it is the mechanism by which "pure TypeScript only" and "no
framework dependency" are enforced: a future engine can consume these contracts from a Next.js API
route, a background worker, a CLI script, or a test file, with identical behavior, because nothing
here assumes it is running inside any of those.

## What "no business logic" excludes, precisely

Two kinds of code live in this module that might look like business logic at a glance, and are
not:

- `versioning/compatibility.ts` compares two semantic versions structurally (is 2.1.0 at least as
  new as 2.0.0, within the same major line). This is the same category of fact as "does this
  object have a `confidence` field" — a fact about the *shape* of two version strings, not a
  judgment about a telecom site.
- `registry/engine-registry.ts` stores and retrieves engine declarations in memory. This is
  bookkeeping (a `Map` with guard rails against duplicate/missing ids), not a decision about risk,
  opportunity, or priority.

Everything else in this module is a type declaration, an interface, or a structural check. No file
reads from or writes to SQLite, no file computes a risk score, and no file makes a recommendation.
