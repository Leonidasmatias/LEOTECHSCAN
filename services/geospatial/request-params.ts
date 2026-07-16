// STAGE 1 -- WP1.7-1.10 Geospatial APIs: pure, dependency-free HTTP query-
// param parsing/validation.
//
// This module takes a plain `URLSearchParams` -- a standard Web API
// available in Node with no import needed -- rather than a Next.js
// `NextRequest`. That is what keeps it dependency-free (no `next/server`,
// no `node:sqlite`, nothing reaching either transitively) and therefore
// directly unit-testable by Vitest, the same way
// services/geospatial/spatial-query-utils.ts is: see
// tests/geospatial-request-params.test.ts, and docs/stage-1/08_TEST_RESULTS.md
// for why any test file whose import graph reaches node:sqlite cannot be
// reliably collected by this project's Vitest pipeline.
//
// Every route handler under app/api/geospatial/** calls into these
// functions rather than re-deriving its own ad hoc parsing/validation --
// confirmed by tests/geospatial-api-contract.test.ts (source inspection,
// never imports the route files as modules).
//
// Requirement being enforced here (Checkpoint 3, requirement 2, "strict
// request validation"): a request with a missing, non-numeric, or
// out-of-range required parameter is rejected outright with a list of
// human-readable reasons, rather than silently coerced to some default (the
// way, for example, `Number(null)` silently becomes `0`). Optional
// parameters with sensible defaults (limit, resolution, radiusKm on the
// nearest endpoint) are the only ones allowed to fall back quietly.
import { validateBoundingBox, type BoundingBox } from "@/services/geospatial/spatial-query-utils";
import { GRID_RESOLUTIONS, isGridResolution, type GridResolution } from "@/services/geospatial/national-grid";

export type ParamResult<T> = { ok: true; value: T } | { ok: false; errors: string[] };

function isBlank(raw: string | null): raw is null {
  return raw === null || raw.trim() === "";
}

function requiredNumber(params: URLSearchParams, name: string): ParamResult<number> {
  const raw = params.get(name);
  if (isBlank(raw)) return { ok: false, errors: [`${name} e obrigatorio.`] };
  const value = Number(raw);
  if (!Number.isFinite(value)) return { ok: false, errors: [`${name} deve ser um numero finito.`] };
  return { ok: true, value };
}

/** Parses and strictly validates the four bounding-box params (north/south/east/west). */
export function parseBoundingBox(params: URLSearchParams): ParamResult<BoundingBox> {
  const names = ["north", "south", "east", "west"] as const;
  const errors: string[] = [];
  const values: Partial<Record<(typeof names)[number], number>> = {};
  for (const name of names) {
    const result = requiredNumber(params, name);
    if (!result.ok) errors.push(...result.errors);
    else values[name] = result.value;
  }
  if (errors.length > 0) return { ok: false, errors };
  const bbox = values as BoundingBox;
  const validation = validateBoundingBox(bbox);
  if (!validation.valid) return { ok: false, errors: validation.reasons };
  return { ok: true, value: bbox };
}

/** Parses and strictly validates a required center point (lat/lon). */
export function parseLatLon(params: URLSearchParams): ParamResult<{ latitude: number; longitude: number }> {
  const lat = requiredNumber(params, "lat");
  const lon = requiredNumber(params, "lon");
  const errors = [...(lat.ok ? [] : lat.errors), ...(lon.ok ? [] : lon.errors)];
  if (!lat.ok || !lon.ok) return { ok: false, errors };
  const latitude = lat.value;
  const longitude = lon.value;
  if (latitude < -90 || latitude > 90) errors.push("lat deve estar entre -90 e 90.");
  if (longitude < -180 || longitude > 180) errors.push("lon deve estar entre -180 e 180.");
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: { latitude, longitude } };
}

/** Parses an optional, positive radiusKm, falling back to `fallback` when absent, rejecting anything else invalid. */
export function parseRadiusKm(params: URLSearchParams, options: { fallback: number; max: number }): ParamResult<number> {
  const raw = params.get("radiusKm");
  if (isBlank(raw)) return { ok: true, value: options.fallback };
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return { ok: false, errors: ["radiusKm deve ser um numero positivo."] };
  if (value > options.max) return { ok: false, errors: [`radiusKm nao pode exceder ${options.max}.`] };
  return { ok: true, value };
}

/** Parses an optional grid resolution (0-3), falling back to `fallback` when absent, rejecting anything unsupported. */
export function parseResolution(params: URLSearchParams, fallback: GridResolution): ParamResult<GridResolution> {
  const raw = params.get("resolution");
  if (isBlank(raw)) return { ok: true, value: fallback };
  const parsed = Number(raw);
  if (!isGridResolution(parsed)) {
    return { ok: false, errors: [`resolution deve ser um dos valores suportados: ${GRID_RESOLUTIONS.join(", ")}.`] };
  }
  return { ok: true, value: parsed };
}

/** Parses an optional positive-integer query param (e.g. limit, excludeSiteId). Returns undefined when absent. */
export function parseOptionalPositiveInt(params: URLSearchParams, name: string): ParamResult<number | undefined> {
  const raw = params.get(name);
  if (isBlank(raw)) return { ok: true, value: undefined };
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return { ok: false, errors: [`${name} deve ser um inteiro positivo.`] };
  return { ok: true, value: Math.floor(value) };
}
