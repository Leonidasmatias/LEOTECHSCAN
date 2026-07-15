import { NextRequest, NextResponse } from "next/server";
import { SITE_SELECT } from "@/api/site-query";
import { getDb, text } from "@/lib/db";
import { siteRow } from "@/services/site-service";
import { calculateLts, calculateOpi, calculateSri, calculateTci, sentinelRules, stars, type MunicipalityMetrics } from "@/services/sentinel-scoring";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toMetric(row: Record<string, unknown>): MunicipalityMetrics {
  return {
    municipio: text(row.municipio),
    uf: text(row.uf),
    records: Number(row.records || 0),
    sites: Number(row.sites || 0),
    operators: Number(row.operators || 0),
    technologies: Number(row.technologies || 0),
    population: Number(row.population || 0),
    avgGeo: Number(row.avg_geo || 0),
  };
}

function distanceKm(aLat: number, aLon: number, bLat: number, bLon: number) {
  const rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad;
  const dLon = (bLon - aLon) * rad;
  const lat1 = aLat * rad;
  const lat2 = bLat * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const db = getDb();
    const raw = db.prepare(`SELECT ${SITE_SELECT} FROM sites WHERE id = ?`).get(Number(id)) as Record<string, unknown> | undefined;
    if (!raw) return NextResponse.json({ error: "Site nao encontrado." }, { status: 404 });
    const site = siteRow(raw);
    const municipality = toMetric(db.prepare("SELECT municipio,uf,COUNT(*) records,COUNT(DISTINCT site) sites,COUNT(DISTINCT operadora_origem) operators,COUNT(DISTINCT tecnologia) technologies,MAX(populacao) population,ROUND(AVG(geo_score),1) avg_geo FROM sites WHERE municipio = ? AND uf = ? GROUP BY uf,municipio").get(site.municipio, site.uf) as Record<string, unknown>);
    const maxima = toMetric(db.prepare("SELECT 'MAX' municipio,'BR' uf,MAX(records) records,MAX(sites) sites,MAX(operators) operators,MAX(technologies) technologies,MAX(population) population,MAX(avg_geo) avg_geo FROM (SELECT municipio,uf,COUNT(*) records,COUNT(DISTINCT site) sites,COUNT(DISTINCT operadora_origem) operators,COUNT(DISTINCT tecnologia) technologies,MAX(populacao) population,ROUND(AVG(geo_score),1) avg_geo FROM sites GROUP BY uf,municipio)").get() as Record<string, unknown>);
    const lts = calculateLts(municipality, maxima);
    const tci = calculateTci(municipality, maxima);
    const opi = calculateOpi(municipality, maxima);
    const sri = calculateSri(municipality, maxima);
    const operatorRanks = db.prepare("SELECT operadora_origem operator, COUNT(*) records, COUNT(DISTINCT site) sites, ROUND(AVG(ori_score),1) ori FROM sites WHERE uf = ? GROUP BY operadora_origem ORDER BY records DESC").all(site.uf) as Record<string, unknown>[];
    const lat = site.latitude;
    const lon = site.longitude;
    const box = sentinelRules.nearby.radiusKm / 111;
    const candidates = db.prepare(`SELECT ${SITE_SELECT} FROM sites WHERE id <> ? AND latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ? LIMIT 2000`).all(site.id, lat - box, lat + box, lon - box, lon + box) as Record<string, unknown>[];
    const nearby = candidates.map(siteRow).map((item) => ({ ...item, distanceKm: Number(distanceKm(lat, lon, item.latitude, item.longitude).toFixed(2)) })).sort((a, b) => a.distanceKm - b.distanceKm).slice(0, sentinelRules.nearby.limit);
    const imports = db.prepare("SELECT arquivo_origem,operadora,linhas_importadas,importado_em,excel_inalterado FROM import_audit WHERE arquivo_origem = ? OR operadora = ? ORDER BY id DESC LIMIT 8").all(site.arquivoOrigem, site.operadoraOrigem) as Record<string, unknown>[];
    const technologies = db.prepare("SELECT tecnologia,COUNT(*) records FROM sites WHERE site = ? GROUP BY tecnologia ORDER BY records DESC").all(site.site) as Record<string, unknown>[];
    const timeline = [
      { type: "importacao", label: "Primeira importacao registrada", date: site.dataImportacao, detail: site.arquivoOrigem },
      { type: "atualizacao", label: "Ultima atualizacao consolidada", date: site.dataImportacao, detail: `${site.operadoraOrigem} - ${site.status}` },
      { type: "operadora", label: "Operadora de origem", date: site.dataImportacao, detail: site.operadoraOrigem },
      { type: "tecnologia", label: "Tecnologias associadas", date: site.dataImportacao, detail: technologies.map((item) => item.tecnologia).join(", ") || site.tecnologia },
      { type: "alerta", label: "Nivel Sentinel Risk Index", date: site.dataImportacao, detail: sri.level },
    ];
    return NextResponse.json({
      site,
      scores: { lts: { ...lts, starsText: stars(lts.stars) }, ori: site.oriScore, tci, opi, sri },
      municipality,
      operatorRanks,
      nearby,
      timeline,
      imports,
      observations: [`Base: ${site.arquivoOrigem}`, `Regional: ${site.regional}`, `Projeto: ${site.projeto}`],
    });
  } catch (error) {
    console.error("site_intelligence_failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Site Intelligence indisponivel." }, { status: 500 });
  }
}
