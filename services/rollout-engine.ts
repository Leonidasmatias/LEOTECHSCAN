import rules from "@/config/sentinel_rules.json";
import { getStrategicMunicipalities, type StrategicMunicipalityRow } from "@/services/strategic-data";
import type { DatabaseSync } from "node:sqlite";

function priority(score: number) {
  return rules.rollout.priority.find((item) => score >= item.min)?.name ?? "Muito Baixa";
}

export function rolloutRows(db: DatabaseSync) {
  return getStrategicMunicipalities(db).map((item: StrategicMunicipalityRow) => {
    const estimatedNewSites = Math.max(1, Math.round(item.opi / 12));
    const teams = Math.max(1, Math.ceil(estimatedNewSites / rules.rollout.targetSitesPerTeam));
    return {
      municipio: item.municipio,
      uf: item.uf,
      opportunityIndex: item.opi,
      lts: item.lts.score,
      tci: item.tci,
      sitesAtuais: item.sites,
      novosSitesEstimados: estimatedNewSites,
      equipesEstimadas: teams,
      mosEstimados: teams * rules.rollout.mosPerTeam,
      instalacoesEstimadas: teams * rules.rollout.installationsPerTeam,
      prioridade: priority(item.opi),
    };
  }).sort((a, b) => b.opportunityIndex - a.opportunityIndex);
}
