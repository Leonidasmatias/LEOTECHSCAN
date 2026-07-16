import { describe, expect, it } from "vitest";
import {
  CANONICAL_ENTITY_KINDS,
  validateBaseEntityShape,
  validateEntityReferenceShape,
  toIdentifier,
  toIsoDateTime,
  type Site,
  type Municipality,
} from "@/services/intelligence";

const NOW = toIsoDateTime("2026-07-16T00:00:00.000Z");

describe("canonical entity catalog", () => {
  it("declares exactly the minimum set required by the mission brief", () => {
    const expected = [
      "Site",
      "Municipality",
      "State",
      "Operator",
      "Technology",
      "TowerCompany",
      "Structure",
      "Equipment",
      "Observation",
      "DataSource",
      "Snapshot",
      "Indicator",
      "Score",
      "Evidence",
      "Recommendation",
      "Scenario",
    ];
    expect([...CANONICAL_ENTITY_KINDS].sort()).toEqual([...expected].sort());
  });

  it("has no duplicate kinds", () => {
    expect(new Set(CANONICAL_ENTITY_KINDS).size).toBe(CANONICAL_ENTITY_KINDS.length);
  });
});

describe("BaseEntity structural validation", () => {
  it("accepts a well-formed entity", () => {
    const municipality: Municipality = {
      kind: "Municipality",
      id: toIdentifier("municipality-1"),
      name: "São Paulo",
      stateId: toIdentifier("state-sp"),
      createdAt: NOW,
      updatedAt: NOW,
      version: 1,
      metadata: {},
    };
    const result = validateBaseEntityShape(municipality);
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it("rejects an object missing required fields", () => {
    const result = validateBaseEntityShape({ kind: "Site" });
    expect(result.valid).toBe(false);
    const paths = result.issues.map((issue) => issue.path);
    expect(paths).toEqual(
      expect.arrayContaining(["id", "createdAt", "updatedAt", "version", "metadata"]),
    );
  });

  it("rejects a non-object value", () => {
    const result = validateBaseEntityShape("not-an-entity");
    expect(result.valid).toBe(false);
  });
});

describe("EntityReference structural validation", () => {
  it("accepts a reference to a recognized canonical kind", () => {
    const site: Site = {
      kind: "Site",
      id: toIdentifier("site-1"),
      municipalityId: toIdentifier("municipality-1"),
      stateId: toIdentifier("state-sp"),
      operatorId: null,
      towerCompanyId: null,
      technologyIds: [],
      createdAt: NOW,
      updatedAt: NOW,
      version: 1,
      metadata: {},
    };
    const result = validateEntityReferenceShape({ kind: site.kind, id: site.id });
    expect(result.valid).toBe(true);
  });

  it("rejects a reference with an unrecognized kind", () => {
    const result = validateEntityReferenceShape({ kind: "NotACanonicalKind", id: "x" });
    expect(result.valid).toBe(false);
  });
});
