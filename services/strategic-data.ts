import type { DatabaseSync } from "node:sqlite";
import { calculateLts, calculateOpi, calculateSri, calculateTci, type MunicipalityMetrics } from "@/services/sentinel-scoring";

export type StrategicMunicipalityRow = MunicipalityMetrics & {
  lts: ReturnType<typeof calculateLts>;
  tci: number;
  opi: number;
  sri: ReturnType<typeof calculateSri>;
  density: number;
  has5g: boolean;
};

function metric(row: Record<string, unknown>): MunicipalityMetrics {
  return {
    municipio: String(row.municipio ?? "Nao informado"),
    uf: String(row.uf ?? "Nao informado"),
    records: Number(row.records || 0),
    sites: Number(row.sites || 0),
    operators: Number(row.operators || 0),
    technologies: Number(row.technologies || 0),
    population: Number(row.population || 0),
    avgGeo: Number(row.avg_geo || 0),
  };
}

function maxima(rows: MunicipalityMetrics[]): MunicipalityMetrics {
  return rows.reduce((max, item) => ({
    municipio: "MAX",
    uf: "BR",
    records: Math.max(max.records, item.records),
    sites: Math.max(max.sites, item.sites),
    operators: Math.max(max.operators, item.operators),
    technologies: Math.max(max.technologies, item.technologies),
    population: Math.max(max.population, item.population),
    avgGeo: Math.max(max.avgGeo, item.avgGeo),
  }), { municipio: "MAX", uf: "BR", records: 1, sites: 1, operators: 1, technologies: 1, population: 1, avgGeo: 1 });
}

export function getStrategicMunicipalities(db: DatabaseSync): StrategicMunicipalityRow[] {
  const raw = db.prepare("SELECT municipio,uf,COUNT(*) records,COUNT(DISTINCT site) sites,COUNT(DISTINCT operadora_origem) operators,COUNT(DISTINCT tecnologia) technologies,MAX(populacao) population,ROUND(AVG(geo_score),1) avg_geo,MAX(CASE WHEN tecnologia LIKE '%5G%' OR tecnologia LIKE '%NR%' THEN 1 ELSE 0 END) has5g FROM sites GROUP BY uf,municipio").all() as Record<string, unknown>[];
  const rows = raw.map(metric);
  const max = maxima(rows);
  return rows.map((item, index) => ({
    ...item,
    lts: calculateLts(item, max),
    tci: calculateTci(item, max),
    opi: calculateOpi(item, max),
    sri: calculateSri(item, max),
    density: Number((item.sites / Math.max(item.population || 1, 1) * 100000).toFixed(3)),
    has5g: Boolean(raw[index].has5g),
  }));
}
