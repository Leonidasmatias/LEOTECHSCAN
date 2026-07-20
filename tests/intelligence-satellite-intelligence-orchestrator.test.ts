// GENESIS PHASE 2 -- Increment 10 (Satellite Intelligence), Wave 5.
// Behavioral and source-inspection tests for
// services/intelligence-runtime/satellite-intelligence-orchestrator.ts and
// -instance.ts, per docs/genesis-phase-2/30_INCREMENT_10_SATELLITE_INTELLIGENCE_IMPLEMENTATION_PLAN.md
// Section 8 (Wave 5) and ACA-001 (Architecture Clarification Amendment):
// full state-matrix derivation, deterministic execution, EvidenceId/truth-
// metadata cross-consistency, no persistence, no forbidden imports.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  createSatelliteIntelligenceOrchestrator,
  type SatelliteIntelligenceOrchestratorDeps,
} from "@/services/intelligence-runtime/satellite-intelligence-orchestrator";
import { createSatelliteFakeProvider } from "@/services/intelligence-adapters/satellite-fake-provider";
import { adaptSatelliteProviderScene } from "@/services/intelligence-adapters/satellite-observation-adapter";
import { adaptSatelliteObservationToEvidence } from "@/services/intelligence-adapters/satellite-evidence-adapter";
import type {
  SatelliteProviderPort,
  SatelliteProviderScene,
  SatelliteProviderQualitySummary,
  SatelliteProviderOutcome,
  SatelliteProviderRequest,
} from "@/services/intelligence-runtime/satellite-intelligence-provider-port";
import type { SiteRow } from "@/lib/types";

const ORCHESTRATOR_FILE = path.resolve(
  __dirname,
  "..",
  "services",
  "intelligence-runtime",
  "satellite-intelligence-orchestrator.ts",
);
const INSTANCE_FILE = path.resolve(
  __dirname,
  "..",
  "services",
  "intelligence-runtime",
  "satellite-intelligence-orchestrator-instance.ts",
);
const FAKE_PROVIDER_FILE = path.resolve(
  __dirname,
  "..",
  "services",
  "intelligence-adapters",
  "satellite-fake-provider.ts",
);

const FIXED_NOW = "2026-01-01T00:00:00.000Z";
const VALID_SITE_ID = 42;

function baseSiteRow(overrides: Partial<SiteRow> = {}): SiteRow {
  return {
    id: VALID_SITE_ID,
    siteId: "SITE-042",
    site: "Test Site",
    operadoraOrigem: "OperatorX",
    elemento: "Elemento",
    tecnologia: "4G",
    municipio: "Sao Paulo",
    estado: "Sao Paulo",
    uf: "SP",
    regional: "Sudeste",
    endereco: "Rua Teste, 123",
    status: "Ativo",
    projeto: "Projeto",
    tipoSite: "Torre",
    detentorInfra: "InfraCo",
    tipoInfra: "Torre",
    latitude: -23.55,
    longitude: -46.63,
    populacao: 1000,
    altura: 30,
    geoScore: 1,
    risco: "baixo",
    stationId: "STA-1",
    operadora: "OperatorX",
    oriScore: 1,
    oriRisk: "baixo",
    dataImportacao: "2025-01-01",
    arquivoOrigem: "import.csv",
    ...overrides,
  };
}

function baseScene(overrides: Partial<SatelliteProviderScene> = {}): SatelliteProviderScene {
  return {
    sourceSceneId: "S1A_IW_GRDH_1SDV_20251201T000000",
    capturedAt: "2025-12-01T00:00:00.000Z", // 31 days before FIXED_NOW
    publishedAt: "2025-12-01T01:00:00.000Z",
    retrievedAt: FIXED_NOW,
    spatialResolutionMeters: 10,
    cloudCoveragePercent: null,
    noDataCoveragePercent: 0,
    coverage: { footprintDescription: "site-centered footprint", radiusKm: 2 },
    sourceAttributes: {},
    ...overrides,
  };
}

function baseQualitySummary(overrides: Partial<SatelliteProviderQualitySummary> = {}): SatelliteProviderQualitySummary {
  return { overallScore: 0.8, overallClassification: "high", ...overrides };
}

function successOutcome(scenes: SatelliteProviderScene[], quality = baseQualitySummary()): SatelliteProviderOutcome {
  return { kind: "success", scenes, qualitySummary: quality };
}

function createRejectingProvider(): SatelliteProviderPort {
  return {
    providerCode: "contract-violating-fake",
    fetch: (_request: SatelliteProviderRequest) => Promise.reject(new Error("simulated provider contract violation")),
  };
}

function baseDeps(overrides: Partial<SatelliteIntelligenceOrchestratorDeps> = {}): SatelliteIntelligenceOrchestratorDeps {
  return {
    fetchSiteRow: (siteId: number) => (siteId === VALID_SITE_ID ? baseSiteRow() : null),
    provider: createSatelliteFakeProvider(successOutcome([baseScene()])),
    dataset: "Sentinel-1 GRD",
    sourceType: "sar",
    adaptObservation: adaptSatelliteProviderScene,
    adaptEvidence: adaptSatelliteObservationToEvidence,
    now: () => FIXED_NOW,
    environment: () => "test",
    ...overrides,
  };
}

describe("Increment 10 Wave 5: files exist", () => {
  it("satellite-intelligence-orchestrator.ts exists at the frozen path", () => {
    expect(fs.existsSync(ORCHESTRATOR_FILE)).toBe(true);
  });
  it("satellite-intelligence-orchestrator-instance.ts exists at the frozen path", () => {
    expect(fs.existsSync(INSTANCE_FILE)).toBe(true);
  });
  it("satellite-fake-provider.ts exists at the frozen path", () => {
    expect(fs.existsSync(FAKE_PROVIDER_FILE)).toBe(true);
  });
});

describe("Increment 10 Wave 5: state matrix — Group 1 (site not found)", () => {
  it("returns notFound with truthMetadata/context/coordinateEligibility all null", async () => {
    const orchestrator = createSatelliteIntelligenceOrchestrator(baseDeps({ fetchSiteRow: () => null }));
    const outcome = await orchestrator.getCanonicalSatelliteIntelligenceForSite(999);
    expect(outcome.notFound).toBe(true);
    expect(outcome.status).toBe("notFound");
    expect(outcome.truthMetadata).toBeNull();
    expect(outcome.context).toBeNull();
    expect(outcome.coordinateEligibility).toBeNull();
    expect(outcome.observations).toEqual([]);
    expect(outcome.evidence).toEqual([]);
  });
});

describe("Increment 10 Wave 5: state matrix — Groups 2/3 (coordinates ineligible, provider never queried)", () => {
  it("zero coordinate: unavailable, no observations, provider never called", async () => {
    let providerCalled = false;
    const provider = createSatelliteFakeProvider(successOutcome([baseScene()]));
    const spyingProvider: SatelliteProviderPort = {
      providerCode: provider.providerCode,
      fetch: (request) => {
        providerCalled = true;
        return provider.fetch(request);
      },
    };
    const orchestrator = createSatelliteIntelligenceOrchestrator(
      baseDeps({ fetchSiteRow: () => baseSiteRow({ latitude: 0, longitude: 0 }), provider: spyingProvider }),
    );
    const outcome = await orchestrator.getCanonicalSatelliteIntelligenceForSite(VALID_SITE_ID);
    expect(outcome.status).toBe("unavailable");
    expect(outcome.notFound).toBe(false);
    expect(outcome.coordinateEligibility).toBe("ineligible");
    expect(outcome.observations).toEqual([]);
    expect(outcome.evidence).toEqual([]);
    expect(providerCalled).toBe(false);
    expect(outcome.truthMetadata).not.toBeNull();
    expect(outcome.context).not.toBeNull();
  });

  it("outside-Brazil coordinate: unavailable, ineligible", async () => {
    const orchestrator = createSatelliteIntelligenceOrchestrator(
      baseDeps({ fetchSiteRow: () => baseSiteRow({ latitude: 51.5, longitude: -0.12 }) }),
    );
    const outcome = await orchestrator.getCanonicalSatelliteIntelligenceForSite(VALID_SITE_ID);
    expect(outcome.status).toBe("unavailable");
    expect(outcome.coordinateEligibility).toBe("ineligible");
  });
});

describe("Increment 10 Wave 5: state matrix — Group 4/5 (provider unavailable)", () => {
  it("misconfigured: unavailable", async () => {
    const orchestrator = createSatelliteIntelligenceOrchestrator(
      baseDeps({ provider: createSatelliteFakeProvider({ kind: "unavailable", reason: "misconfigured" }) }),
    );
    const outcome = await orchestrator.getCanonicalSatelliteIntelligenceForSite(VALID_SITE_ID);
    expect(outcome.status).toBe("unavailable");
    expect(outcome.observations).toEqual([]);
    expect(outcome.evidence).toEqual([]);
  });

  it("invalid_credentials: unavailable", async () => {
    const orchestrator = createSatelliteIntelligenceOrchestrator(
      baseDeps({ provider: createSatelliteFakeProvider({ kind: "unavailable", reason: "invalid_credentials" }) }),
    );
    const outcome = await orchestrator.getCanonicalSatelliteIntelligenceForSite(VALID_SITE_ID);
    expect(outcome.status).toBe("unavailable");
  });

  it("timeout: unavailable", async () => {
    const orchestrator = createSatelliteIntelligenceOrchestrator(
      baseDeps({ provider: createSatelliteFakeProvider({ kind: "unavailable", reason: "timeout" }) }),
    );
    const outcome = await orchestrator.getCanonicalSatelliteIntelligenceForSite(VALID_SITE_ID);
    expect(outcome.status).toBe("unavailable");
  });

  it("rate_limited: unavailable", async () => {
    const orchestrator = createSatelliteIntelligenceOrchestrator(
      baseDeps({ provider: createSatelliteFakeProvider({ kind: "unavailable", reason: "rate_limited" }) }),
    );
    const outcome = await orchestrator.getCanonicalSatelliteIntelligenceForSite(VALID_SITE_ID);
    expect(outcome.status).toBe("unavailable");
  });

  it("unexpected_error: unavailable", async () => {
    const orchestrator = createSatelliteIntelligenceOrchestrator(
      baseDeps({ provider: createSatelliteFakeProvider({ kind: "unavailable", reason: "unexpected_error" }) }),
    );
    const outcome = await orchestrator.getCanonicalSatelliteIntelligenceForSite(VALID_SITE_ID);
    expect(outcome.status).toBe("unavailable");
  });
});

describe("Increment 10 Wave 5: state matrix — Group 6 (no_coverage)", () => {
  it("no_coverage: complete, zero observations, distinct from unavailable", async () => {
    const orchestrator = createSatelliteIntelligenceOrchestrator(
      baseDeps({ provider: createSatelliteFakeProvider({ kind: "no_coverage" }) }),
    );
    const outcome = await orchestrator.getCanonicalSatelliteIntelligenceForSite(VALID_SITE_ID);
    expect(outcome.status).toBe("complete");
    expect(outcome.observations).toEqual([]);
    expect(outcome.evidence).toEqual([]);
  });

  it("success outcome with an empty scene array: also complete, zero observations", async () => {
    const orchestrator = createSatelliteIntelligenceOrchestrator(
      baseDeps({ provider: createSatelliteFakeProvider(successOutcome([])) }),
    );
    const outcome = await orchestrator.getCanonicalSatelliteIntelligenceForSite(VALID_SITE_ID);
    expect(outcome.status).toBe("complete");
    expect(outcome.observations).toEqual([]);
  });
});

describe("Increment 10 Wave 5: state matrix — Groups 7/8 (complete, fresh and stale, none rejected)", () => {
  it("all fresh, none rejected: complete, one observation, one evidence", async () => {
    const orchestrator = createSatelliteIntelligenceOrchestrator(baseDeps());
    const outcome = await orchestrator.getCanonicalSatelliteIntelligenceForSite(VALID_SITE_ID);
    expect(outcome.status).toBe("complete");
    expect(outcome.observations).toHaveLength(1);
    expect(outcome.evidence).toHaveLength(1);
    expect(outcome.issues).toEqual([]);
  });

  it("stale imagery alone (no rejected scenes): still complete, disclosed not excluded", async () => {
    const staleScene = baseScene({ capturedAt: "2025-01-01T00:00:00.000Z" }); // far more than 45 days before FIXED_NOW
    const orchestrator = createSatelliteIntelligenceOrchestrator(
      baseDeps({ provider: createSatelliteFakeProvider(successOutcome([staleScene])) }),
    );
    const outcome = await orchestrator.getCanonicalSatelliteIntelligenceForSite(VALID_SITE_ID);
    expect(outcome.status).toBe("complete");
    expect(outcome.observations).toHaveLength(1);
    expect(outcome.observations[0].temporal.freshness).toBe("stale");
    expect(outcome.issues).toEqual([]);
  });
});

describe("Increment 10 Wave 5: state matrix — Group 9 (partial: mixed usable/rejected)", () => {
  it("3 usable, 2 rejected (missing sourceSceneId): partial, only usable observations/evidence present", async () => {
    const scenes = [
      baseScene({ sourceSceneId: "scene-a" }),
      baseScene({ sourceSceneId: "scene-b" }),
      baseScene({ sourceSceneId: "scene-c" }),
      baseScene({ sourceSceneId: null }),
      baseScene({ sourceSceneId: null }),
    ];
    const orchestrator = createSatelliteIntelligenceOrchestrator(
      baseDeps({ provider: createSatelliteFakeProvider(successOutcome(scenes)) }),
    );
    const outcome = await orchestrator.getCanonicalSatelliteIntelligenceForSite(VALID_SITE_ID);
    expect(outcome.status).toBe("partial");
    expect(outcome.observations).toHaveLength(3);
    expect(outcome.evidence).toHaveLength(3);
    expect(outcome.issues).toHaveLength(2);
    for (const issue of outcome.issues) {
      expect(issue.code).toBe("missing_scene_id");
      expect(issue.stage).toBe("observation");
    }
  });

  it("1 usable, 4 rejected: still partial (at least one usable)", async () => {
    const scenes = [
      baseScene({ sourceSceneId: "scene-only" }),
      baseScene({ sourceSceneId: null }),
      baseScene({ sourceSceneId: null }),
      baseScene({ sourceSceneId: null }),
      baseScene({ sourceSceneId: null }),
    ];
    const orchestrator = createSatelliteIntelligenceOrchestrator(
      baseDeps({ provider: createSatelliteFakeProvider(successOutcome(scenes)) }),
    );
    const outcome = await orchestrator.getCanonicalSatelliteIntelligenceForSite(VALID_SITE_ID);
    expect(outcome.status).toBe("partial");
    expect(outcome.observations).toHaveLength(1);
    expect(outcome.evidence).toHaveLength(1);
    expect(outcome.issues).toHaveLength(4);
  });
});

describe("Increment 10 Wave 5: state matrix — Group 10 (all scenes rejected: unavailable, not partial)", () => {
  it("0 of 5 usable: unavailable (Rule 3c), never partial, zero observations/evidence", async () => {
    const scenes = [
      baseScene({ sourceSceneId: null }),
      baseScene({ sourceSceneId: null }),
      baseScene({ sourceSceneId: null }),
      baseScene({ sourceSceneId: null }),
      baseScene({ sourceSceneId: null }),
    ];
    const orchestrator = createSatelliteIntelligenceOrchestrator(
      baseDeps({ provider: createSatelliteFakeProvider(successOutcome(scenes)) }),
    );
    const outcome = await orchestrator.getCanonicalSatelliteIntelligenceForSite(VALID_SITE_ID);
    expect(outcome.status).toBe("unavailable");
    expect(outcome.observations).toEqual([]);
    expect(outcome.evidence).toEqual([]);
    expect(outcome.issues).toHaveLength(5);
  });
});

describe("Increment 10 Wave 5: state matrix — Group 11 (failed: our own code, not a normal provider outcome)", () => {
  it("a contract-violating provider whose fetch() rejects maps to failed, not unavailable", async () => {
    const orchestrator = createSatelliteIntelligenceOrchestrator(baseDeps({ provider: createRejectingProvider() }));
    const outcome = await orchestrator.getCanonicalSatelliteIntelligenceForSite(VALID_SITE_ID);
    expect(outcome.status).toBe("failed");
    expect(outcome.notFound).toBe(false);
    expect(outcome.observations).toEqual([]);
    expect(outcome.evidence).toEqual([]);
  });

  it("failed still carries non-null truthMetadata (mandatory whenever notFound is false)", async () => {
    const orchestrator = createSatelliteIntelligenceOrchestrator(baseDeps({ provider: createRejectingProvider() }));
    const outcome = await orchestrator.getCanonicalSatelliteIntelligenceForSite(VALID_SITE_ID);
    expect(outcome.truthMetadata).not.toBeNull();
    expect(outcome.truthMetadata?.realSatelliteEvidence).toBe(false);
  });

  it("this failed path is distinct from the provider's own normal unexpected_error outcome", async () => {
    const rejecting = createSatelliteIntelligenceOrchestrator(baseDeps({ provider: createRejectingProvider() }));
    const rejectingOutcome = await rejecting.getCanonicalSatelliteIntelligenceForSite(VALID_SITE_ID);
    const normal = createSatelliteIntelligenceOrchestrator(
      baseDeps({ provider: createSatelliteFakeProvider({ kind: "unavailable", reason: "unexpected_error" }) }),
    );
    const normalOutcome = await normal.getCanonicalSatelliteIntelligenceForSite(VALID_SITE_ID);
    expect(rejectingOutcome.status).toBe("failed");
    expect(normalOutcome.status).toBe("unavailable");
  });
});

describe("Increment 10 Wave 5: ACA-001-B — EvidenceId cross-consistency", () => {
  it("SatelliteObservation.evidenceId equals Evidence.id for every included observation", async () => {
    const scenes = [baseScene({ sourceSceneId: "scene-x" }), baseScene({ sourceSceneId: "scene-y" })];
    const orchestrator = createSatelliteIntelligenceOrchestrator(
      baseDeps({ provider: createSatelliteFakeProvider(successOutcome(scenes)) }),
    );
    const outcome = await orchestrator.getCanonicalSatelliteIntelligenceForSite(VALID_SITE_ID);
    expect(outcome.observations).toHaveLength(2);
    expect(outcome.evidence).toHaveLength(2);
    for (let i = 0; i < outcome.observations.length; i++) {
      expect(outcome.observations[i].evidenceId).toBe(outcome.evidence[i].id);
    }
  });

  it("any future divergence between the inline formula and the Wave 4 adapter's own formula would fail this test", async () => {
    // Directly proves the two independent computations agree for a fixed,
    // known input — the mandatory safeguard ACA-001-B requires. Uses the
    // fake provider's own providerCode ("satellite-fake-provider"), since
    // both computations derive it from `deps.provider.providerCode`/
    // `observation.provider.providerCode` respectively -- the point being
    // proven is that the two formulas agree for whichever providerCode is
    // in play, not that either one hardcodes the real legacy provider's code.
    const scene = baseScene({ sourceSceneId: "cross-consistency-scene" });
    const orchestrator = createSatelliteIntelligenceOrchestrator(
      baseDeps({ provider: createSatelliteFakeProvider(successOutcome([scene])) }),
    );
    const outcome = await orchestrator.getCanonicalSatelliteIntelligenceForSite(VALID_SITE_ID);
    expect(outcome.observations[0].evidenceId).toMatch(/^satellite:satellite-fake-provider:42:[0-9a-f]{64}$/);
    expect(outcome.evidence[0].id).toBe(outcome.observations[0].evidenceId);
  });
});

describe("Increment 10 Wave 5: ACA-001-A — truthMetadata assertions", () => {
  it("every non-notFound outcome carries non-null truthMetadata with dataReality: simulated", async () => {
    const orchestrator = createSatelliteIntelligenceOrchestrator(baseDeps());
    const outcome = await orchestrator.getCanonicalSatelliteIntelligenceForSite(VALID_SITE_ID);
    expect(outcome.truthMetadata).not.toBeNull();
    expect(outcome.truthMetadata?.dataReality).toBe("simulated");
    expect(outcome.truthMetadata?.realSatelliteEvidence).toBe(false);
    expect(outcome.truthMetadata?.simulationReason).not.toBeNull();
    expect(outcome.truthMetadata?.sourceDisclosure).toBe("dataStatus=simulated; source=local_rule_engine");
  });

  it("truthMetadata is null only for the notFound case", async () => {
    const orchestrator = createSatelliteIntelligenceOrchestrator(baseDeps({ fetchSiteRow: () => null }));
    const outcome = await orchestrator.getCanonicalSatelliteIntelligenceForSite(999);
    expect(outcome.notFound).toBe(true);
    expect(outcome.truthMetadata).toBeNull();
  });

  it("no code path ever sets dataReality to provider_sourced", async () => {
    const cases: Array<() => Promise<{ truthMetadata: { dataReality: string } | null }>> = [
      () => createSatelliteIntelligenceOrchestrator(baseDeps()).getCanonicalSatelliteIntelligenceForSite(VALID_SITE_ID),
      () =>
        createSatelliteIntelligenceOrchestrator(
          baseDeps({ provider: createSatelliteFakeProvider({ kind: "unavailable", reason: "timeout" }) }),
        ).getCanonicalSatelliteIntelligenceForSite(VALID_SITE_ID),
      () =>
        createSatelliteIntelligenceOrchestrator(baseDeps({ provider: createRejectingProvider() })).getCanonicalSatelliteIntelligenceForSite(
          VALID_SITE_ID,
        ),
    ];
    for (const run of cases) {
      const outcome = await run();
      if (outcome.truthMetadata) {
        expect(outcome.truthMetadata.dataReality).not.toBe("provider_sourced");
      }
    }
  });
});

describe("Increment 10 Wave 5: determinism", () => {
  it("identical input produces an identical outcome across repeated calls", async () => {
    const orchestrator = createSatelliteIntelligenceOrchestrator(baseDeps());
    const a = await orchestrator.getCanonicalSatelliteIntelligenceForSite(VALID_SITE_ID);
    const b = await orchestrator.getCanonicalSatelliteIntelligenceForSite(VALID_SITE_ID);
    expect(a).toEqual(b);
  });

  it("two independently-constructed orchestrators with identical deps produce identical outcomes", async () => {
    const a = await createSatelliteIntelligenceOrchestrator(baseDeps()).getCanonicalSatelliteIntelligenceForSite(VALID_SITE_ID);
    const b = await createSatelliteIntelligenceOrchestrator(baseDeps()).getCanonicalSatelliteIntelligenceForSite(VALID_SITE_ID);
    expect(a).toEqual(b);
  });
});

describe("Increment 10 Wave 5: async contract", () => {
  it("getCanonicalSatelliteIntelligenceForSite returns a genuine Promise", () => {
    const orchestrator = createSatelliteIntelligenceOrchestrator(baseDeps());
    const result = orchestrator.getCanonicalSatelliteIntelligenceForSite(VALID_SITE_ID);
    expect(result).toBeInstanceOf(Promise);
  });
});

describe("Increment 10 Wave 5: exact operation order", () => {
  it("site lookup happens before the provider is ever called", async () => {
    const order: string[] = [];
    const provider = createSatelliteFakeProvider(successOutcome([baseScene()]));
    const spyingProvider: SatelliteProviderPort = {
      providerCode: provider.providerCode,
      fetch: (request) => {
        order.push("provider");
        return provider.fetch(request);
      },
    };
    const orchestrator = createSatelliteIntelligenceOrchestrator(
      baseDeps({
        fetchSiteRow: (siteId) => {
          order.push("site-lookup");
          return siteId === VALID_SITE_ID ? baseSiteRow() : null;
        },
        provider: spyingProvider,
      }),
    );
    await orchestrator.getCanonicalSatelliteIntelligenceForSite(VALID_SITE_ID);
    expect(order).toEqual(["site-lookup", "provider"]);
  });

  it("observation adaptation happens before evidence adaptation, per scene, for a single scene", async () => {
    const order: string[] = [];
    const orchestrator = createSatelliteIntelligenceOrchestrator(
      baseDeps({
        adaptObservation: (scene, context, now) => {
          order.push("observation");
          return adaptSatelliteProviderScene(scene, context, now);
        },
        adaptEvidence: (observation, context) => {
          order.push("evidence");
          return adaptSatelliteObservationToEvidence(observation, context);
        },
      }),
    );
    await orchestrator.getCanonicalSatelliteIntelligenceForSite(VALID_SITE_ID);
    expect(order).toEqual(["observation", "evidence"]);
  });

  it("interleaves observation/evidence per scene across multiple scenes (W5R-1) -- never batches all observations before any evidence", async () => {
    // A single-scene test cannot distinguish genuine per-scene interleaving
    // (observation1, evidence1, observation2, evidence2) from an incorrect
    // batch-then-batch implementation (observation1, observation2, evidence1,
    // evidence2), since both produce the same two-entry order array for one
    // scene. This test uses two distinct scenes and records which scene each
    // call concerns, so the two orderings produce genuinely different,
    // distinguishable sequences.
    const order: string[] = [];
    const scenes = [baseScene({ sourceSceneId: "scene-one" }), baseScene({ sourceSceneId: "scene-two" })];
    const orchestrator = createSatelliteIntelligenceOrchestrator(
      baseDeps({
        provider: createSatelliteFakeProvider(successOutcome(scenes)),
        adaptObservation: (scene, context, now) => {
          order.push(`observation:${scene.sourceSceneId}`);
          return adaptSatelliteProviderScene(scene, context, now);
        },
        adaptEvidence: (observation, context) => {
          order.push(`evidence:${context.sourceSceneId}`);
          return adaptSatelliteObservationToEvidence(observation, context);
        },
      }),
    );
    await orchestrator.getCanonicalSatelliteIntelligenceForSite(VALID_SITE_ID);
    expect(order).toEqual([
      "observation:scene-one",
      "evidence:scene-one",
      "observation:scene-two",
      "evidence:scene-two",
    ]);
    // Explicitly documents the incorrect ordering this test must reject, so
    // a future reader sees exactly what a batch-then-batch regression would
    // produce and why the assertion above would fail it.
    const batchThenBatchOrdering = [
      "observation:scene-one",
      "observation:scene-two",
      "evidence:scene-one",
      "evidence:scene-two",
    ];
    expect(order).not.toEqual(batchThenBatchOrdering);
  });
});

describe("Increment 10 Wave 5: provider call count (W5R-2)", () => {
  // A stateless fake provider returns identical results regardless of call
  // count, so result-content assertions alone cannot detect a regression
  // that calls the provider more than once. These tests count calls
  // directly, independent of what the provider returns.
  function countingProvider(outcome: SatelliteProviderOutcome): { provider: SatelliteProviderPort; count: () => number } {
    let calls = 0;
    return {
      provider: {
        providerCode: "counting-fake-provider",
        fetch: (request: SatelliteProviderRequest) => {
          calls += 1;
          return Promise.resolve(outcome);
        },
      },
      count: () => calls,
    };
  }

  it("success path: the provider is called exactly once", async () => {
    const counting = countingProvider(successOutcome([baseScene()]));
    const orchestrator = createSatelliteIntelligenceOrchestrator(baseDeps({ provider: counting.provider }));
    await orchestrator.getCanonicalSatelliteIntelligenceForSite(VALID_SITE_ID);
    expect(counting.count()).toBe(1);
  });

  it("notFound: the provider is never called", async () => {
    const counting = countingProvider(successOutcome([baseScene()]));
    const orchestrator = createSatelliteIntelligenceOrchestrator(
      baseDeps({ fetchSiteRow: () => null, provider: counting.provider }),
    );
    await orchestrator.getCanonicalSatelliteIntelligenceForSite(999);
    expect(counting.count()).toBe(0);
  });

  it("coordinate-ineligible: the provider is never called", async () => {
    const counting = countingProvider(successOutcome([baseScene()]));
    const orchestrator = createSatelliteIntelligenceOrchestrator(
      baseDeps({ fetchSiteRow: () => baseSiteRow({ latitude: 0, longitude: 0 }), provider: counting.provider }),
    );
    await orchestrator.getCanonicalSatelliteIntelligenceForSite(VALID_SITE_ID);
    expect(counting.count()).toBe(0);
  });
});

describe("Increment 10 Wave 5: no input mutation", () => {
  it("never mutates the deps object or the SiteRow it reads", async () => {
    const siteRow = baseSiteRow();
    const siteRowSnapshot = JSON.parse(JSON.stringify(siteRow));
    const deps = baseDeps({ fetchSiteRow: () => siteRow });
    const depsSnapshot = { dataset: deps.dataset, sourceType: deps.sourceType };
    await createSatelliteIntelligenceOrchestrator(deps).getCanonicalSatelliteIntelligenceForSite(VALID_SITE_ID);
    expect(siteRow).toEqual(siteRowSnapshot);
    expect(deps.dataset).toBe(depsSnapshot.dataset);
    expect(deps.sourceType).toBe(depsSnapshot.sourceType);
  });
});

describe("Increment 10 Wave 5: Waves 1-4 compatibility", () => {
  it("uses the real, unmodified Wave 2 and Wave 4 adapters end to end without error", async () => {
    const orchestrator = createSatelliteIntelligenceOrchestrator(baseDeps());
    await expect(orchestrator.getCanonicalSatelliteIntelligenceForSite(VALID_SITE_ID)).resolves.toBeDefined();
  });

  it("every returned Evidence has the frozen forced-low reliability and satellite-specific origin", async () => {
    const orchestrator = createSatelliteIntelligenceOrchestrator(baseDeps());
    const outcome = await orchestrator.getCanonicalSatelliteIntelligenceForSite(VALID_SITE_ID);
    for (const evidence of outcome.evidence) {
      expect(evidence.reliability).toBe(0.1);
      expect(evidence.origin.source).toBe("satellite-intelligence");
    }
  });
});

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

function listTsFilesRecursive(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listTsFilesRecursive(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".ts")) {
      files.push(fullPath);
    }
  }
  return files;
}

describe("Increment 10 Wave 5: no persistence, no forbidden imports (source inspection)", () => {
  const orchestratorSource = stripComments(fs.readFileSync(ORCHESTRATOR_FILE, "utf8"));
  const instanceSource = stripComments(fs.readFileSync(INSTANCE_FILE, "utf8"));
  const fakeProviderSource = stripComments(fs.readFileSync(FAKE_PROVIDER_FILE, "utf8"));

  it("no Date.now(), Math.random(), or crypto.randomUUID() in any of the three Wave 5 files", () => {
    for (const source of [orchestratorSource, instanceSource, fakeProviderSource]) {
      expect(source).not.toMatch(/Date\.now\(/);
      expect(source).not.toMatch(/Math\.random\(/);
      expect(source).not.toMatch(/crypto\.randomUUID\(/);
    }
  });

  it("the orchestrator core contains no Promise.all (W5R-2) -- exactly one provider call per request, no concurrency machinery", () => {
    expect(orchestratorSource).not.toMatch(/Promise\.all\(/);
  });

  it("no INSERT/UPDATE/DELETE/UPSERT/CREATE TABLE/ALTER TABLE SQL write pattern in any of the three files", () => {
    // Case-sensitive, matching this codebase's own established SQL-keyword
    // casing convention (e.g. "CREATE TABLE IF NOT EXISTS") -- deliberately
    // NOT case-insensitive, so it never false-positives on legitimate
    // lowercase JS method calls that happen to share a keyword's spelling
    // (e.g. `createHash(...).update(...)`, a node:crypto API call, not SQL).
    const writePattern = /\b(INSERT|UPDATE|DELETE|UPSERT|CREATE TABLE|ALTER TABLE)\b/;
    for (const source of [orchestratorSource, instanceSource, fakeProviderSource]) {
      expect(source).not.toMatch(writePattern);
    }
  });

  it("no console.error/console.log/console.warn in any of the three files (handler.ts's own future job)", () => {
    for (const source of [orchestratorSource, instanceSource, fakeProviderSource]) {
      expect(source).not.toMatch(/console\.(error|log|warn)\(/);
    }
  });

  it("no next or next/server import in any of the three files", () => {
    for (const source of [orchestratorSource, instanceSource, fakeProviderSource]) {
      expect(source).not.toMatch(/from\s*["']next\/server["']/);
      expect(source).not.toMatch(/from\s*["']next["']/);
    }
  });

  it("no direct node:sqlite import in any of the three files", () => {
    for (const source of [orchestratorSource, instanceSource, fakeProviderSource]) {
      expect(source).not.toMatch(/from\s*["']node:sqlite["']/);
    }
  });

  it("the orchestrator core's own raw source never contains the database or API-route path substrings, even in a comment", () => {
    const rawSource = fs.readFileSync(ORCHESTRATOR_FILE, "utf8");
    expect(rawSource).not.toMatch(/@\/lib\/db/);
    expect(rawSource).not.toMatch(/@\/app\/api/);
  });

  it("the orchestrator-instance's own raw source never contains the database path substring, even in a comment", () => {
    const rawSource = fs.readFileSync(INSTANCE_FILE, "utf8");
    expect(rawSource).not.toMatch(/@\/lib\/db/);
  });

  it("the orchestrator core does not import copernicus-engine", () => {
    expect(orchestratorSource).not.toMatch(/copernicus-engine/);
  });

  it("the orchestrator core imports copernicus-truth exactly once, value-wise, per ACA-001-A", () => {
    expect(orchestratorSource).toMatch(/from\s*["']@\/services\/copernicus-truth["']/);
  });

  it("the orchestrator-instance does not import copernicus-engine or copernicus-truth directly (only transitively, through the Wave 3 io/ files)", () => {
    expect(instanceSource).not.toMatch(/copernicus-engine/);
    expect(instanceSource).not.toMatch(/copernicus-truth/);
  });

  it("the fake provider imports neither copernicus-engine nor copernicus-truth", () => {
    expect(fakeProviderSource).not.toMatch(/copernicus-engine/);
    expect(fakeProviderSource).not.toMatch(/copernicus-truth/);
  });

  it("the orchestrator core does not value-import satellite-observation-adapter.ts or satellite-evidence-adapter.ts (received via injected deps only)", () => {
    const valueImportPattern = /^import\s+\{[^}]*\}\s+from\s*["'][^"']*(satellite-observation-adapter|satellite-evidence-adapter)["']/m;
    expect(orchestratorSource).not.toMatch(valueImportPattern);
  });
});

describe("Increment 10 Wave 5: repository-wide Copernicus import allowlist (extended per ACA-001-A)", () => {
  const scanDirs = [
    path.resolve(__dirname, "..", "services", "intelligence-adapters"),
    path.resolve(__dirname, "..", "services", "intelligence-runtime"),
  ];
  const allowedImporters = new Set([
    path.resolve(__dirname, "..", "services", "intelligence-adapters", "evidence-adapter.ts"),
    path.resolve(__dirname, "..", "services", "intelligence-adapters", "io", "legacy-copernicus-provider.ts"),
    ORCHESTRATOR_FILE,
  ]);

  it("copernicus-engine/copernicus-truth are imported only by the three explicitly authorized files", () => {
    const offenders: string[] = [];
    for (const dir of scanDirs) {
      for (const file of listTsFilesRecursive(dir)) {
        const source = fs.readFileSync(file, "utf8");
        const importsCopernicus = /from\s*["'][^"']*copernicus-(engine|truth)["']/.test(source);
        if (importsCopernicus && !allowedImporters.has(file)) {
          offenders.push(file);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("legacy-copernicus-provider.ts imports only copernicus-engine, not copernicus-truth", () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, "..", "services", "intelligence-adapters", "io", "legacy-copernicus-provider.ts"),
      "utf8",
    );
    expect(source).toMatch(/from\s*["']@\/services\/copernicus-engine["']/);
    expect(source).not.toMatch(/from\s*["']@\/services\/copernicus-truth["']/);
  });

  it("evidence-adapter.ts (grandfathered) imports only copernicus-truth, not copernicus-engine", () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, "..", "services", "intelligence-adapters", "evidence-adapter.ts"),
      "utf8",
    );
    expect(source).toMatch(/from\s*["']@\/services\/copernicus-truth["']/);
    expect(source).not.toMatch(/from\s*["']@\/services\/copernicus-engine["']/);
  });

  it("the Wave 5 orchestrator core imports only copernicus-truth, not copernicus-engine", () => {
    const source = fs.readFileSync(ORCHESTRATOR_FILE, "utf8");
    expect(source).toMatch(/from\s*["']@\/services\/copernicus-truth["']/);
    expect(source).not.toMatch(/from\s*["']@\/services\/copernicus-engine["']/);
  });
});
