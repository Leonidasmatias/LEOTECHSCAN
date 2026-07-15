import type { DatabaseSync } from "node:sqlite";
import type { OperatorMetric } from "./types";
import { text } from "./db";

export function getOperatorMetrics(db: DatabaseSync, sql: string, values: string[]): OperatorMetric[] {
  const operatorRows = db.prepare(`SELECT COALESCE(operadora_classificada,'Não Identificado') operator, COUNT(*) records, COUNT(DISTINCT site_id) sites, COUNT(DISTINCT estado) states, COUNT(DISTINCT municipio) municipalities, COUNT(DISTINCT tecnologia) technologies, ROUND(AVG(CASE WHEN altura > 0 THEN altura END),1) average_height, ROUND(AVG(geo_score),1) average_geo, ROUND(AVG(ori_score),1) average_ori FROM sites ${sql} GROUP BY operadora_classificada ORDER BY records DESC`).all(...values) as Record<string, unknown>[];
  const populationRows = db.prepare(`SELECT operator, SUM(population) population FROM (SELECT COALESCE(operadora_classificada,'Não Identificado') operator, estado, municipio, MAX(populacao) population FROM sites ${sql} GROUP BY operadora_classificada,estado,municipio) GROUP BY operator`).all(...values) as Record<string, unknown>[];
  const population = new Map(populationRows.map(item => [text(item.operator), Number(item.population || 0)]));
  const raw = operatorRows.map(item => ({ operator: text(item.operator), records: Number(item.records), sites: Number(item.sites), states: Number(item.states), municipalities: Number(item.municipalities), technologies: Number(item.technologies), averageHeight: Number(item.average_height || 0), averageGeo: Number(item.average_geo || 0), averageOri: Number(item.average_ori || 0), population: population.get(text(item.operator)) || 0 }));
  const maxima = raw.reduce((max, item) => ({ population: Math.max(max.population, item.population), sites: Math.max(max.sites, item.sites), states: Math.max(max.states, item.states), municipalities: Math.max(max.municipalities, item.municipalities), technologies: Math.max(max.technologies, item.technologies) }), { population: 1, sites: 1, states: 1, municipalities: 1, technologies: 1 });
  return raw.map(item => ({ ...item, tci: Math.round((item.population / maxima.population) * 30 + (item.sites / maxima.sites) * 30 + (item.technologies / maxima.technologies) * 20 + ((item.states / maxima.states) * .4 + (item.municipalities / maxima.municipalities) * .6) * 20) }));
}
