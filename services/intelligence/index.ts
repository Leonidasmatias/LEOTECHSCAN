/**
 * Sentinel Intelligence Foundation — public entry point.
 *
 * This is the single official language every current and future
 * intelligence engine (Risk, Opportunity, Confidence, Priority, Data Trust,
 * Recommendation, Machine Learning, Simulation, Forecast, Optimization,
 * Executive AI, ...) is expected to import from. It re-exports the
 * complete contract surface built in Genesis Phase 1: shared types,
 * canonical entities, the Score/Evidence/Recommendation models, the
 * calculation context, the engine registry, versioning, typed errors, and
 * structural validation.
 *
 * Nothing in this module — or anything it exports — performs a
 * calculation, persists data, or depends on a framework. See
 * docs/genesis-phase-1/ for the full rationale behind every export here.
 */

export * from "./types";

export * from "./contracts";

export * from "./entities";

export * from "./context";

export * from "./registry";

export * from "./evidence";

export * from "./recommendations";

export * from "./scoring";

export * from "./versioning";

export * from "./errors";

export * from "./validation";
