import rules from "@/config/sentinel_rules.json";
import { getStrategicMunicipalities } from "@/services/strategic-data";
import type { DatabaseSync } from "node:sqlite";

export function alertRows(db: DatabaseSync) {
  const now = new Date().toISOString();
  const alerts = [];
  for (const item of getStrategicMunicipalities(db)) {
    if (!item.has5g) alerts.push({ criticidade: "Media", data: now, origem: "Telecom AI", categoria: "Municipio sem 5G", descricao: `${item.municipio}/${item.uf} sem tecnologia 5G identificada.`, recomendacao: "Avaliar expansao 5G e backhaul." });
    if (item.sites <= rules.alerts.lowDensitySites) alerts.push({ criticidade: "Alta", data: now, origem: "Alert Center", categoria: "Baixa densidade", descricao: `${item.municipio}/${item.uf} possui ${item.sites} site(s).`, recomendacao: "Priorizar estudo de cobertura." });
    if (item.operators === 1) alerts.push({ criticidade: "Alta", data: now, origem: "Alert Center", categoria: "Operadora unica", descricao: `${item.municipio}/${item.uf} possui apenas uma operadora.`, recomendacao: "Mapear oportunidade competitiva." });
    if (item.sri.score >= rules.alerts.criticalSri) alerts.push({ criticidade: "Critica", data: now, origem: "SRI", categoria: "Municipio critico", descricao: `${item.municipio}/${item.uf} com SRI ${item.sri.score}.`, recomendacao: "Executar plano de mitigacao territorial." });
    if (item.opi >= 80) alerts.push({ criticidade: "Alta", data: now, origem: "OPI", categoria: "Prioritario", descricao: `${item.municipio}/${item.uf} com OPI ${item.opi}.`, recomendacao: "Incluir no ranking de rollout." });
  }
  const missingCoordinates = db.prepare("SELECT COUNT(*) total FROM sites WHERE latitude = 0 OR longitude = 0").get() as Record<string, unknown>;
  if (Number(missingCoordinates.total) > 0) alerts.push({ criticidade: "Media", data: now, origem: "Data Quality", categoria: "Sites sem coordenadas", descricao: `${missingCoordinates.total} registros sem coordenadas validas.`, recomendacao: "Corrigir geocadastro na base origem." });
  return alerts.slice(0, 500);
}
