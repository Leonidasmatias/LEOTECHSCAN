// STAGE 1 -- WP1.7-1.9 Geospatial APIs -- pure compact-payload tests.
//
// Imports ONLY services/geospatial/compact-site.ts. No node:sqlite
// anywhere in this file's import graph. Exercises the "return compact
// payloads only" requirement (Checkpoint 3, requirement 5) directly: the
// mapped object must carry exactly the documented compact fields, never the
// full ~24-field siteRow()/SITE_SELECT shape (e.g. arquivo_origem,
// data_importacao, station_id must never leak through).
import { describe, it, expect } from "vitest";
import { toCompactSite, toCompactSiteWithDistance, COMPACT_SITE_KEYS } from "@/services/geospatial/compact-site";

const RAW_SITE_ROW = {
  id: 42,
  site_id: "SP-0001",
  site: "SP-0001",
  operadora_origem: "OperadoraA",
  operadora_classificada: "OperadoraA Classificada",
  tipo_elemento: "Torre",
  tecnologia: "5G",
  municipio: "Sao Paulo",
  estado: "Sao Paulo",
  uf: "SP",
  regional: "Sudeste",
  endereco: "Rua Exemplo, 123",
  status_normalizado: "ativo",
  status: "ATIVO",
  projeto: "Expansao",
  tipo_site: "Torre",
  detentor_infra: "InfraCo",
  tipo_infra: "propria",
  latitude: -23.5505,
  longitude: -46.6333,
  populacao: 12000000,
  altura: 45,
  geo_score: 87.5,
  risco: "baixo",
  station_id: "STX-42",
  ori_score: 91,
  ori_risk: "baixo",
  data_importacao: "2026-01-01",
  arquivo_origem: "import_2026_01.xlsx",
};

describe("toCompactSite", () => {
  it("maps the expected fields from a raw sites row", () => {
    const compact = toCompactSite(RAW_SITE_ROW);
    expect(compact).toEqual({
      id: 42,
      site: "SP-0001",
      municipio: "Sao Paulo",
      uf: "SP",
      operadora: "OperadoraA Classificada",
      tecnologia: "5G",
      status: "ativo",
      latitude: -23.5505,
      longitude: -46.6333,
      geoScore: 87.5,
    });
  });

  it("never leaks the heavy Stage-0 fields (compact payloads only)", () => {
    const compact = toCompactSite(RAW_SITE_ROW);
    const keys = Object.keys(compact);
    expect(keys.sort()).toEqual([...COMPACT_SITE_KEYS].sort());
    expect(keys).not.toContain("arquivo_origem");
    expect(keys).not.toContain("arquivoOrigem");
    expect(keys).not.toContain("data_importacao");
    expect(keys).not.toContain("dataImportacao");
    expect(keys).not.toContain("station_id");
    expect(keys).not.toContain("stationId");
    expect(keys).not.toContain("endereco");
  });

  it("falls back gracefully on missing/null fields rather than throwing", () => {
    const compact = toCompactSite({ id: 1 });
    expect(compact.site).toBe("");
    expect(compact.municipio).toBe("");
    expect(compact.latitude).toBe(0);
    expect(compact.geoScore).toBe(0);
  });

  it("prefers operadora_classificada over operadora_origem, matching siteRow()'s precedence", () => {
    const compact = toCompactSite({ ...RAW_SITE_ROW, operadora_classificada: undefined });
    expect(compact.operadora).toBe("OperadoraA");
  });
});

describe("toCompactSiteWithDistance", () => {
  it("preserves the distanceKm field attached by withDistances()", () => {
    const compact = toCompactSiteWithDistance({ ...RAW_SITE_ROW, distanceKm: 12.345 });
    expect(compact.distanceKm).toBe(12.345);
    expect(compact.id).toBe(42);
  });

  it("defaults distanceKm to 0 when absent rather than NaN/undefined", () => {
    const compact = toCompactSiteWithDistance({ id: 1 });
    expect(compact.distanceKm).toBe(0);
  });
});
