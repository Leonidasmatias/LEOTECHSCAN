import type { SemVerString } from "../types/common";
import type { SemanticVersion } from "./version";

/**
 * Structural semantic-version parsing, formatting, and comparison.
 *
 * WHY THIS EXISTS
 * ---------------------------------------------------------------------------
 * These are contract mechanics, not business logic: "is 2.1.0 at least as
 * new as 2.0.0" is a structural fact about two version strings, the same
 * kind of fact `validation/validators.ts` establishes about entity shapes.
 * No intelligence engine's scoring or recommendation logic lives here —
 * only the shared arithmetic every engine and every consumer needs to
 * reason about `EngineVersionInfo` (versioning/version.ts).
 */

const SEMVER_PATTERN =
  /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-.]+))?(?:\+([0-9A-Za-z-.]+))?$/;

/**
 * Parses a {@link SemVerString} into its structural {@link SemanticVersion}
 * form. Returns `null` (rather than throwing) for malformed input, so
 * callers at a validation boundary can decide how to react — throwing
 * belongs to `validation/validators.ts`, not here.
 */
export function parseSemanticVersion(
  value: SemVerString | string,
): SemanticVersion | null {
  const match = SEMVER_PATTERN.exec(value);
  if (!match) {
    return null;
  }
  const [, major, minor, patch, prerelease, build] = match;
  return {
    major: Number(major),
    minor: Number(minor),
    patch: Number(patch),
    prerelease: prerelease ?? null,
    build: build ?? null,
  };
}

/**
 * Formats a {@link SemanticVersion} back into its canonical string form.
 * The inverse of {@link parseSemanticVersion}.
 */
export function formatSemanticVersion(version: SemanticVersion): string {
  const prerelease = version.prerelease ? `-${version.prerelease}` : "";
  const build = version.build ? `+${version.build}` : "";
  return `${version.major}.${version.minor}.${version.patch}${prerelease}${build}`;
}

/**
 * Compares two semantic versions per semver precedence rules (build
 * metadata is ignored for comparison, as the spec requires).
 *
 * Returns a negative number if `a` precedes `b`, a positive number if `a`
 * follows `b`, and `0` if they are equal in precedence.
 */
export function compareSemanticVersions(
  a: SemanticVersion,
  b: SemanticVersion,
): number {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  if (a.patch !== b.patch) return a.patch - b.patch;

  // A version without a prerelease has higher precedence than one with.
  if (a.prerelease === null && b.prerelease !== null) return 1;
  if (a.prerelease !== null && b.prerelease === null) return -1;
  if (a.prerelease === null && b.prerelease === null) return 0;

  return (a.prerelease as string).localeCompare(b.prerelease as string);
}

/**
 * Whether `candidate` is compatible with a declared
 * `minimumCompatibleVersion` — i.e. `candidate >= minimumCompatibleVersion`
 * and shares the same major version (per semver, a major bump signals
 * breaking changes regardless of minor/patch ordering).
 */
export function isVersionCompatible(
  candidate: SemanticVersion,
  minimumCompatibleVersion: SemanticVersion,
): boolean {
  if (candidate.major !== minimumCompatibleVersion.major) {
    return false;
  }
  return compareSemanticVersions(candidate, minimumCompatibleVersion) >= 0;
}
