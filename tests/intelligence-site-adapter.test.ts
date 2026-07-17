// GENESIS PHASE 2 -- Increment 3 (Site Entity Adapter).
// Pure unit tests for services/intelligence-adapters/site-entity-adapter.ts.
// No I/O, no node:sqlite -- constructed entirely from plain object literals,
// per services/geospatial/compact-site.ts's own established test pattern.
import { describe, it, expect } from "vitest";
import type { SiteRow } from "@/lib/types";
import {
  adaptLegacySiteRow,
  toSiteEntityReference,
  SITE_ADAPTER_UNMAPPED_FIELDS,
} from "@/services/intelligence-adapters";
import { validateBaseEntityShape } from "@/services/intelligence";

function validRow(overrides: Partial<SiteRow> = {}): SiteRow {
  return {
    id: 42,
    siteId: "SITE042",
    site: "SITE042",
    operadoraOrigem: "VIVO",
    elemento: "TORRE",
    tecnologia: "4G",
    municipio: "Sao Paulo",
    estado: "SP",
    uf: "SP",
    regional: "SUDESTE",
    endereco: "Rua Teste, 123",
    status: "ATIVO",
    projeto: "Projeto X",
    tipoSite: "Torre",
    detentorInfra: "American Tower",
    tipoInfra: "Monopole",
    latitude: -23.55,
    longitude: -46.63,
    populacao: 12000000,
    altura: 30,
    geoScore: 85,
    risco: "BAIXO",
    stationId: "STA042",
    operadora: "VIVO",
    oriScore: 10,
    oriRisk: "BAIXO",
    dataImportacao: "2026-01-15",
    arquivoOrigem: "vivo_sites.xlsx",
    ...overrides,
  };
}

describe("adaptLegacySiteRow", () => {
  it("1. adapts a valid, complete legacy row successfully", () => {
    const result = adaptLegacySiteRow(validRow());
    expect(result.success).toBe(true);
    expect(result.site).not.toBeNull();
    expect(result.site?.kind).toBe("Site");
  });

  it("2. the produced canonical entity validates structurally", () => {
    const result = adaptLegacySiteRow(validRow());
    expect(result.site).not.toBeNull();
    const structural = validateBaseEntityShape(result.site);
    expect(structural.valid).toBe(true);
    expect(structural.issues).toHaveLength(0);
  });

  it("3. the database row id maps deterministically to the canonical id", () => {
    const result = adaptLegacySiteRow(validRow({ id: 4242 }));
    expect(result.site?.id).toBe("4242");
  });

  it("4. the telecom site code is preserved separately from entity identity", () => {
    const result = adaptLegacySiteRow(validRow({ id: 42, site: "SITE042" }));
    expect(result.site?.id).toBe("42");
    expect(result.site?.id).not.toBe("SITE042");
    expect(result.site?.metadata.legacySiteCode).toBe("SITE042");
  });

  it("5. the same input produces the same output (deterministic)", () => {
    const row = validRow();
    const a = adaptLegacySiteRow(row);
    const b = adaptLegacySiteRow(row);
    expect(a).toEqual(b);
  });

  it("6. the input object is never mutated", () => {
    const row = validRow();
    const pristine = JSON.parse(JSON.stringify(row));
    adaptLegacySiteRow(row);
    expect(row).toEqual(pristine);
  });

  it("7. an empty optional string normalizes to absence without blocking adaptation", () => {
    const result = adaptLegacySiteRow(validRow({ operadora: "" }));
    expect(result.success).toBe(true);
    expect(result.site?.operatorId).toBeNull();
    expect(result.issues.some((i) => i.code === "missing_operator")).toBe(true);
  });

  it("8. whitespace trimming is deterministic -- padded and unpadded values derive the same id", () => {
    const padded = adaptLegacySiteRow(validRow({ operadora: "  VIVO  " }));
    const unpadded = adaptLegacySiteRow(validRow({ operadora: "VIVO" }));
    expect(padded.site?.operatorId).toBe(unpadded.site?.operatorId);
  });

  it("9. the known legacy placeholder becomes absence only, not an error", () => {
    const result = adaptLegacySiteRow(validRow({ operadora: "Não informado" }));
    expect(result.success).toBe(true);
    expect(result.site?.operatorId).toBeNull();
    const found = result.issues.find((i) => i.code === "missing_operator");
    expect(found?.canContinue).toBe(true);
  });

  it("10. the original placeholder/raw value remains traceable in metadata", () => {
    const result = adaptLegacySiteRow(validRow({ site: "Não informado" }));
    expect(result.site?.metadata.legacySiteCode).toBe("Não informado");
    expect(result.issues.some((i) => i.code === "missing_site_code")).toBe(true);
  });

  it("11. numeric coordinate input is preserved verbatim", () => {
    const result = adaptLegacySiteRow(validRow({ latitude: -23.55, longitude: -46.63 }));
    expect(result.sourceReference.latitude).toBe(-23.55);
    expect(result.sourceReference.longitude).toBe(-46.63);
    expect(result.sourceReference.rawLatitude).toBe(-23.55);
    expect(result.sourceReference.rawLongitude).toBe(-46.63);
  });

  it("12. numeric-string coordinates parse correctly", () => {
    const row = validRow({ latitude: "-23.55" as unknown as number, longitude: "-46.63" as unknown as number });
    const result = adaptLegacySiteRow(row);
    expect(result.sourceReference.latitude).toBe(-23.55);
    expect(result.sourceReference.longitude).toBe(-46.63);
  });

  it("13. invalid coordinate strings produce an issue and are not silently corrected", () => {
    const row = validRow({ latitude: "not-a-number" as unknown as number });
    const result = adaptLegacySiteRow(row);
    expect(result.sourceReference.latitude).toBeNull();
    expect(result.sourceReference.rawLatitude).toBe("not-a-number" as unknown as number);
    expect(result.issues.some((i) => i.code === "invalid_coordinate_number" && i.field === "latitude")).toBe(true);
    // still succeeds -- coordinates are not part of the canonical Site contract.
    expect(result.success).toBe(true);
  });

  it("14. latitude and longitude are never swapped automatically", () => {
    const result = adaptLegacySiteRow(validRow({ latitude: -46.63, longitude: -23.55 }));
    expect(result.sourceReference.latitude).toBe(-46.63);
    expect(result.sourceReference.longitude).toBe(-23.55);
  });

  it("15. missing optional fields (operator, tower company, technology) do not prevent adaptation", () => {
    const result = adaptLegacySiteRow(
      validRow({ operadora: "", detentorInfra: "", tecnologia: "" }),
    );
    expect(result.success).toBe(true);
    expect(result.site?.operatorId).toBeNull();
    expect(result.site?.towerCompanyId).toBeNull();
    expect(result.site?.technologyIds).toEqual([]);
  });

  it("16. a missing/invalid stable identity (database id) prevents success", () => {
    const zero = adaptLegacySiteRow(validRow({ id: 0 }));
    expect(zero.success).toBe(false);
    expect(zero.issues.some((i) => i.code === "invalid_database_id")).toBe(true);

    const negative = adaptLegacySiteRow(validRow({ id: -5 }));
    expect(negative.success).toBe(false);

    const nonInteger = adaptLegacySiteRow(validRow({ id: 4.5 }));
    expect(nonInteger.success).toBe(false);
  });

  it("17. a missing site code does not collapse two distinct rows", () => {
    const a = adaptLegacySiteRow(validRow({ id: 1, site: "" }));
    const b = adaptLegacySiteRow(validRow({ id: 2, site: "" }));
    expect(a.site?.id).not.toBe(b.site?.id);
    expect(a.success).toBe(true);
    expect(b.success).toBe(true);
  });

  it("18. unknown/extra legacy fields do not contaminate the canonical entity", () => {
    const row = { ...validRow(), extraLegacyField: "should not leak" } as unknown as SiteRow;
    const result = adaptLegacySiteRow(row);
    expect(result.site).not.toBeNull();
    expect(Object.keys(result.site as object).sort()).toEqual(
      ["kind", "id", "createdAt", "updatedAt", "version", "metadata", "municipalityId", "stateId", "operatorId", "towerCompanyId", "technologyIds"].sort(),
    );
  });

  it("19. unmapped fields are exposed explicitly via the chosen design (a static, documented list)", () => {
    const result = adaptLegacySiteRow(validRow());
    expect(result.unmappedFields).toBe(SITE_ADAPTER_UNMAPPED_FIELDS);
    expect(result.unmappedFields).toContain("latitude");
    expect(result.unmappedFields).toContain("endereco");
  });

  it("20. suspected mojibake/encoding artifacts are preserved verbatim, never rewritten", () => {
    const suspiciousCode = "SITE-SÃ£o-Paulo";
    const result = adaptLegacySiteRow(validRow({ site: suspiciousCode }));
    expect(result.site?.metadata.legacySiteCode).toBe(suspiciousCode);
  });

  it("27. adaptation issues never contain a distinctive raw value or full row content", () => {
    const distinctiveMarker = "UNIQUE-MARKER-DO-NOT-LEAK-9f3a";
    const result = adaptLegacySiteRow(validRow({ endereco: distinctiveMarker, id: 0 }));
    for (const issueItem of result.issues) {
      expect(issueItem.message).not.toContain(distinctiveMarker);
      expect(JSON.stringify(issueItem)).not.toContain(distinctiveMarker);
    }
  });

  it("28. the result is JSON-serializable and round-trips", () => {
    const result = adaptLegacySiteRow(validRow());
    const roundTripped = JSON.parse(JSON.stringify(result));
    expect(roundTripped).toEqual(JSON.parse(JSON.stringify(result)));
    expect(() => JSON.stringify(result)).not.toThrow();
  });

  it("29. repeated execution does not accumulate state across calls", () => {
    const first = adaptLegacySiteRow(validRow({ id: 1, municipio: "Campinas" }));
    const second = adaptLegacySiteRow(validRow({ id: 2, municipio: "Santos" }));
    const third = adaptLegacySiteRow(validRow({ id: 1, municipio: "Campinas" }));
    expect(first).toEqual(third);
    expect(first.site?.municipalityId).not.toBe(second.site?.municipalityId);
  });

  it("toSiteEntityReference narrows an adapted Site to a bare EntityReference", () => {
    const result = adaptLegacySiteRow(validRow());
    expect(result.site).not.toBeNull();
    const ref = toSiteEntityReference(result.site!);
    expect(ref).toEqual({ kind: "Site", id: result.site!.id });
  });

  it("a missing municipality or UF blocks success (required canonical fields)", () => {
    const noMunicipio = adaptLegacySiteRow(validRow({ municipio: "" }));
    expect(noMunicipio.success).toBe(false);
    expect(noMunicipio.issues.some((i) => i.code === "missing_municipality")).toBe(true);

    const noUf = adaptLegacySiteRow(validRow({ uf: "" }));
    expect(noUf.success).toBe(false);
    expect(noUf.issues.some((i) => i.code === "missing_uf")).toBe(true);
  });

  it("a missing/invalid import date blocks success (createdAt/updatedAt required)", () => {
    const result = adaptLegacySiteRow(validRow({ dataImportacao: "" }));
    expect(result.success).toBe(false);
    expect(result.issues.some((i) => i.code === "missing_timestamp")).toBe(true);
  });

  it("municipality identity is namespaced by state (two states, same municipality name, distinct ids)", () => {
    const spResult = adaptLegacySiteRow(validRow({ municipio: "Bom Jesus", uf: "SP" }));
    const rsResult = adaptLegacySiteRow(validRow({ municipio: "Bom Jesus", uf: "RS" }));
    expect(spResult.site?.municipalityId).not.toBe(rsResult.site?.municipalityId);
  });
});
