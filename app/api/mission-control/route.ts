import { NextResponse } from "next/server";
import { getDb, text } from "@/lib/db";
import { calculateLts, calculateOpi, calculateSri, calculateTci, sentinelRules, stars, type MunicipalityMetrics } from "@/services/sentinel-scoring";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let missionCache: { expiresAt: number; body: unknown } | undefined;

function metric(row: Record<string, unknown>): MunicipalityMetrics {
  return {
    municipio: text(row.municipio),
    uf: text(row.uf ?? row.estado),
    records: Number(row.records || 0),
    sites: Number(row.sites || 0),
    operators: Number(row.operators || 0),
    technologies: Number(row.technologies || 0),
    population: Number(row.population || 0),
    avgGeo: Number(row.avg_geo || 0),
  };
}

function maxMetrics(rows: MunicipalityMetrics[]): MunicipalityMetrics {
  return rows.reduce(
    (max, item) => ({
      municipio: "MAX",
      uf: "BR",
      records: Math.max(max.records, item.records),
      sites: Math.max(max.sites, item.sites),
      operators: Math.max(max.operators, item.operators),
      technologies: Math.max(max.technologies, item.technologies),
      population: Math.max(max.population, item.population),
      avgGeo: Math.max(max.avgGeo, item.avgGeo),
    }),
    { municipio: "MAX", uf: "BR", records: 1, sites: 1, operators: 1, technologies: 1, population: 1, avgGeo: 1 }
  );
}

export async function GET() {
  const started = Date.now();
  try {
    if (missionCache && missionCache.expiresAt > Date.now()) return NextResponse.json(missionCache.body);
    const db = getDb();
    const integrity = db.prepare("PRAGMA integrity_check").get() as Record<string, unknown>;
    const summary = db.prepare("SELECT COUNT(*) records, COUNT(DISTINCT site) sites, COUNT(DISTINCT operadora_origem) operators, COUNT(DISTINCT municipio) municipalities, COUNT(DISTINCT uf) states, COUNT(DISTINCT tecnologia) technologies, ROUND(AVG(geo_score),1) avg_geo FROM sites").get() as Record<string, unknown>;
    const meta = Object.fromEntries((db.prepare("SELECT key,value FROM metadata").all() as Array<{ key: string; value: string }>).map((item) => [item.key, item.value]));
    const byUf = db.prepare("SELECT uf label, COUNT(*) records, COUNT(DISTINCT site) sites FROM sites GROUP BY uf ORDER BY records DESC").all() as Record<string, unknown>[];
    const operators = db.prepare("SELECT operadora_origem operator, COUNT(*) records, COUNT(DISTINCT site) sites, COUNT(DISTINCT uf) states, COUNT(DISTINCT municipio) municipalities, COUNT(DISTINCT tecnologia) technologies, ROUND(AVG(ori_score),1) average_ori FROM sites GROUP BY operadora_origem ORDER BY records DESC").all() as Record<string, unknown>[];
    const imports = db.prepare("SELECT arquivo_origem,operadora,linhas_importadas,fallback_usado,excel_inalterado,importado_em FROM import_audit ORDER BY id DESC LIMIT 8").all() as Record<string, unknown>[];
    const municipalityRows = (db.prepare("SELECT municipio,uf,COUNT(*) records,COUNT(DISTINCT site) sites,COUNT(DISTINCT operadora_origem) operators,COUNT(DISTINCT tecnologia) technologies,MAX(populacao) population,ROUND(AVG(geo_score),1) avg_geo FROM sites GROUP BY uf,municipio").all() as Record<string, unknown>[]).map(metric);
    const maxima = maxMetrics(municipalityRows);
    const scored = municipalityRows.map((item) => {
      const lts = calculateLts(item, maxima);
      const tci = calculateTci(item, maxima);
      const opi = calculateOpi(item, maxima);
      const sri = calculateSri(item, maxima);
      return { ...item, lts: { ...lts, starsText: stars(lts.stars) }, tci, opi, sri };
    });
    const alerts = scored.filter((item) => item.sri.score >= sentinelRules.limits.alertCriticalSri || item.lts.score < sentinelRules.limits.alertLowLts).length;
    const apiMs = Date.now() - started;
    const body = {
      status: { database: integrity.integrity_check === "ok" ? "ok" : "attention", api: apiMs <= sentinelRules.limits.healthyApiMs ? "ok" : "slow", apiMs },
      kpis: {
        totalSites: Number(summary.sites || 0),
        totalOperators: Number(summary.operators || 0),
        totalMunicipalities: Number(summary.municipalities || 0),
        totalStates: Number(summary.states || 0),
        totalRecords: Number(summary.records || 0),
        lastImport: meta.imported_at || "",
        alerts,
        avgLts: scored.length ? Math.round(scored.reduce((sum, item) => sum + item.lts.score, 0) / scored.length) : 0,
      },
      cards: {
        coverage: byUf.length,
        growth: imports.reduce((sum, item) => sum + Number(item.linhas_importadas || 0), 0),
        topMunicipality: [...scored].sort((a, b) => b.records - a.records)[0] ?? null,
      },
      rankings: {
        national: [...scored].sort((a, b) => b.lts.score - a.lts.score).slice(0, 20),
        state: [...scored].sort((a, b) => b.tci - a.tci).slice(0, 20),
        topMunicipalities: [...scored].sort((a, b) => b.records - a.records).slice(0, 20),
        opi: [...scored].sort((a, b) => b.opi - a.opi).slice(0, 20),
        sri: [...scored].sort((a, b) => b.sri.score - a.sri.score).slice(0, 20),
      },
      distributions: { byUf, operators },
      imports,
    };
    missionCache = { expiresAt: Date.now() + 60_000, body };
    return NextResponse.json(body);
  } catch (error) {
    console.error("mission_control_failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Mission Control indisponivel." }, { status: 503 });
  }
}
