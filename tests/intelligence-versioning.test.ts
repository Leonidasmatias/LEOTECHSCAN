import { describe, expect, it } from "vitest";
import {
  parseSemanticVersion,
  formatSemanticVersion,
  compareSemanticVersions,
  isVersionCompatible,
  type SemVerString,
} from "@/services/intelligence";

describe("semantic version parsing", () => {
  it("parses a plain version", () => {
    expect(parseSemanticVersion("1.2.3" as SemVerString)).toEqual({
      major: 1,
      minor: 2,
      patch: 3,
      prerelease: null,
      build: null,
    });
  });

  it("parses prerelease and build metadata", () => {
    expect(parseSemanticVersion("1.2.3-beta.1+build.5" as SemVerString)).toEqual({
      major: 1,
      minor: 2,
      patch: 3,
      prerelease: "beta.1",
      build: "build.5",
    });
  });

  it("returns null for malformed input", () => {
    expect(parseSemanticVersion("not-a-version")).toBeNull();
    expect(parseSemanticVersion("1.2")).toBeNull();
  });

  it("round-trips through format", () => {
    const parsed = parseSemanticVersion("2.10.4-rc.2" as SemVerString);
    expect(parsed).not.toBeNull();
    expect(formatSemanticVersion(parsed!)).toBe("2.10.4-rc.2");
  });
});

describe("semantic version comparison", () => {
  it("orders major, then minor, then patch", () => {
    const v1 = parseSemanticVersion("1.0.0" as SemVerString)!;
    const v2 = parseSemanticVersion("1.0.1" as SemVerString)!;
    const v3 = parseSemanticVersion("1.1.0" as SemVerString)!;
    const v4 = parseSemanticVersion("2.0.0" as SemVerString)!;
    expect(compareSemanticVersions(v1, v2)).toBeLessThan(0);
    expect(compareSemanticVersions(v2, v3)).toBeLessThan(0);
    expect(compareSemanticVersions(v3, v4)).toBeLessThan(0);
    expect(compareSemanticVersions(v1, v1)).toBe(0);
  });

  it("ranks a prerelease below its corresponding release", () => {
    const prerelease = parseSemanticVersion("1.0.0-beta.1" as SemVerString)!;
    const release = parseSemanticVersion("1.0.0" as SemVerString)!;
    expect(compareSemanticVersions(prerelease, release)).toBeLessThan(0);
  });
});

describe("version compatibility", () => {
  it("accepts a version at or above the minimum, within the same major", () => {
    const candidate = parseSemanticVersion("1.4.0" as SemVerString)!;
    const minimum = parseSemanticVersion("1.2.0" as SemVerString)!;
    expect(isVersionCompatible(candidate, minimum)).toBe(true);
  });

  it("rejects a version below the minimum", () => {
    const candidate = parseSemanticVersion("1.1.0" as SemVerString)!;
    const minimum = parseSemanticVersion("1.2.0" as SemVerString)!;
    expect(isVersionCompatible(candidate, minimum)).toBe(false);
  });

  it("rejects a version from a different major line, even if numerically greater", () => {
    const candidate = parseSemanticVersion("2.0.0" as SemVerString)!;
    const minimum = parseSemanticVersion("1.2.0" as SemVerString)!;
    expect(isVersionCompatible(candidate, minimum)).toBe(false);
  });
});
