import { createHash } from "node:crypto";
import type { LegacyEvidenceItem } from "./evidence-adapter";

/**
 * Genesis Phase 2 — Increment 8 (Evidence checksum helper).
 *
 * Pure, dependency-free deterministic content fingerprint for one legacy
 * evidence item, per `docs/genesis-phase-2/26_INCREMENT_8_IMPLEMENTATION_PLAN.md`
 * Section 7. No database access, no `Date.now()`, no `Math.random()`, no
 * external package -- only Node's own built-in `node:crypto`, already an
 * accepted "pure" platform capability in this repository (`lib/auth-guard.ts`
 * imports `node:crypto`'s `timingSafeEqual` and is unit-tested directly with
 * no `node:sqlite`-style exclusion).
 *
 * This is a **content fingerprint, not a cryptographic proof**: it exists so
 * a future reader can detect that an evidence item's own payload
 * (`type`/`source`/`status`/`summary`) has drifted since it was recorded --
 * it is not a tamper-proof signature and carries no authentication
 * guarantee. SHA-256 is used here purely for its strong collision
 * resistance as a hash function.
 *
 * Deliberately excludes `siteId`, `timestamp`, `snapshot`, and array
 * position -- the checksum is a fingerprint of the evidence item's own
 * content only, matching `Evidence.checksum`'s own documented purpose
 * ("content-integrity checksum of the evidence payload").
 */

const CHECKSUM_VERSION_PREFIX = "sha256-v1:";

/** ASCII Unit Separator (decimal code point 31, hex 1F) -- a real, standard
 * control character reserved for exactly this purpose, never expected in
 * human-authored evidence text. Built via `String.fromCharCode` rather than
 * typed as a literal raw byte in source, so its intent stays visible and
 * unambiguous rather than an invisible character easy to corrupt via
 * editing or copy-paste. */
const UNIT_SEPARATOR = String.fromCharCode(31);

function normalize(value: string): string {
  return (value ?? "").trim();
}

/**
 * Builds the fixed-order, delimiter-joined serialization the checksum is
 * computed over. Field order (`type`, `source`, `status`, `summary`) is
 * fixed and hardcoded here -- never derived from the input object's own
 * iteration order -- so the output is deterministic regardless of how the
 * caller happened to construct `item`.
 */
function serialize(item: LegacyEvidenceItem): string {
  return [normalize(item.type), normalize(item.source), normalize(item.status), normalize(item.summary)].join(
    UNIT_SEPARATOR,
  );
}

/**
 * Computes a deterministic content fingerprint for one legacy evidence item.
 * Same input always produces the same output; never throws; never mutates
 * `item`.
 */
export function computeEvidenceChecksum(item: LegacyEvidenceItem): string {
  const digest = createHash("sha256").update(serialize(item), "utf8").digest("hex");
  return `${CHECKSUM_VERSION_PREFIX}${digest}`;
}
