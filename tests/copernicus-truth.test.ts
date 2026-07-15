// STAGE 0 -- WP0.10 Initial Automated Tests (9 of 10+1).
// Covers WP0.4 Correct Copernicus/Sentinel-1 Representation (audit-v4 risk R1).
//
// This test imports ONLY services/copernicus-truth.ts -- a dependency-free module with no
// import chain reaching node:sqlite. It deliberately does NOT import
// services/copernicus-engine.ts, because that module transitively imports node:sqlite via
// services/site-service.ts -> lib/db.ts, which Vitest's Vite-based module pipeline could not
// reliably resolve at test-collection time (see docs/stage-0/05_TEST_BASELINE.md's "Follow-up"
// section for the full history: an externalization config change alone was not sufficient).
// Splitting the pure truth contract out of the DB-touching engine is what actually removes the
// dependency for this test, rather than trying to configure the test runner around it.
//
// tests/copernicus-engine-contract.test.ts is the companion test that confirms
// services/copernicus-engine.ts actually uses this module (via source inspection, so it also
// never imports the engine at runtime) -- together the two tests cover both "the contract
// itself is correct" and "the engine actually honors it."
import { describe, it, expect } from "vitest";
import {
  copernicusTruthMetadata,
  isTruthfulCopernicusResponse,
  allScenesAreMarkedSynthetic,
  COPERNICUS_DATA_STATUS,
  COPERNICUS_SOURCE,
  COPERNICUS_IS_REAL_SATELLITE_EVIDENCE,
  MOCK_SCENE_ID_PREFIX,
} from "@/services/copernicus-truth";

describe("services/copernicus-truth (WP0.4 truth contract, DB-free)", () => {
  it("test 9/10: copernicusTruthMetadata() always returns the fixed simulated/non-real triplet", () => {
    // Called twice to make explicit that this is a pure function with no hidden state, env
    // var, or credential dependency -- exactly the property audit-v4 risk R1 requires.
    const first = copernicusTruthMetadata();
    const second = copernicusTruthMetadata();
    expect(first).toEqual(second);
    expect(first).toEqual({
      dataStatus: "simulated",
      source: "local_rule_engine",
      isRealSatelliteEvidence: false,
    });
    expect(COPERNICUS_DATA_STATUS).toBe("simulated");
    expect(COPERNICUS_SOURCE).toBe("local_rule_engine");
    expect(COPERNICUS_IS_REAL_SATELLITE_EVIDENCE).toBe(false);
  });

  it("test 9b: isTruthfulCopernicusResponse() accepts a correct response and rejects an incorrect one", () => {
    expect(isTruthfulCopernicusResponse(copernicusTruthMetadata())).toBe(true);
    expect(isTruthfulCopernicusResponse({ dataStatus: "simulated", source: "local_rule_engine", isRealSatelliteEvidence: false, extra: "field ok" })).toBe(true);

    // The exact regression this guards against: a response that claims real satellite evidence.
    expect(isTruthfulCopernicusResponse({ dataStatus: "real", source: "copernicus_api", isRealSatelliteEvidence: true })).toBe(false);
    expect(isTruthfulCopernicusResponse({ dataStatus: "simulated", source: "local_rule_engine", isRealSatelliteEvidence: true })).toBe(false);
    expect(isTruthfulCopernicusResponse(null)).toBe(false);
    expect(isTruthfulCopernicusResponse(undefined)).toBe(false);
    expect(isTruthfulCopernicusResponse("simulated")).toBe(false);
    expect(isTruthfulCopernicusResponse({})).toBe(false);
  });

  it("test 9c: allScenesAreMarkedSynthetic() requires every scene id to carry the MOCK_S1_ prefix", () => {
    expect(MOCK_SCENE_ID_PREFIX).toBe("MOCK_S1_");
    expect(allScenesAreMarkedSynthetic([])).toBe(true);
    expect(allScenesAreMarkedSynthetic(["MOCK_S1_TEST_SITE_001_20260703_ASCENDING", "MOCK_S1_TEST_SITE_001_20260621_DESCENDING"])).toBe(true);
    expect(allScenesAreMarkedSynthetic(["MOCK_S1_ok", "S1A_IW_GRDH_real_looking_id"])).toBe(false);
  });
});
