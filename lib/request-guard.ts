// STAGE 0 -- WP0.7 Basic API Protection (audit-v4 risk R2 partial mitigation).
//
// Lightweight, dependency-free request-input guards. These do NOT add authentication or
// rate limiting (see docs/stage-0/03_SECURITY_REMEDIATION.md for the full picture and what
// remains open) -- they only bound the shape of individual inputs so a single malformed or
// abusive request cannot force an unbounded-cost query or an oversized payload.
//
// Coverage note: applied to the endpoints identified as highest-risk in the V4 audit
// (free-text query params, unbounded numeric radius params). Extending this to every one of
// the 43 documented endpoints is tracked as Stage 1+ backlog, not silently claimed here.

/** Truncates free-text query input to a sane maximum length. */
export function clampQueryText(value: string | null | undefined, maxLen = 500, fallback = ""): string {
  const text = (value ?? "").toString();
  if (!text) return fallback;
  return text.length > maxLen ? text.slice(0, maxLen) : text;
}

/** Parses a numeric query param and clamps it into [min, max], falling back on invalid input. */
export function clampQueryNumber(value: string | null | undefined, options: { min: number; max: number; fallback: number }): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return options.fallback;
  return Math.min(options.max, Math.max(options.min, parsed));
}
