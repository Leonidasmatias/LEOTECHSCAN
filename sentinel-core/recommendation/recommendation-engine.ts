import type { DatabaseSync } from "node:sqlite";
import { recommendationRules } from "@/sentinel-core/recommendation/recommendation-rules";

export function getRecommendations(db: DatabaseSync, scope = "global") {
  const lowTrust = db.prepare("SELECT site_id siteId,site,trust_score trustScore FROM site_trust_scores WHERE trust_score < 60 ORDER BY trust_score ASC LIMIT 10").all();
  const missingCopernicus = db.prepare("SELECT s.id siteId,s.site FROM sites s LEFT JOIN site_satellite_validation v ON v.site_id=s.id WHERE v.id IS NULL AND s.latitude BETWEEN -34 AND 6 AND s.longitude BETWEEN -75 AND -32 LIMIT 10").all();
  const rollout = db.prepare("SELECT municipio,uf,COUNT(*) records,COUNT(DISTINCT operadora_origem) operators FROM sites GROUP BY municipio,uf HAVING operators <= 1 ORDER BY records ASC LIMIT 10").all();
  return {
    scope,
    recommendations: [
      ...recommendationRules.map((title, index) => ({ type: "GLOBAL_RULE", priority: index + 1, title, evidence: null })),
      ...lowTrust.map((item: any) => ({ type: "LOW_TRUST", priority: 1, title: `Revisar trust de ${item.site}`, evidence: item })),
      ...missingCopernicus.map((item: any) => ({ type: "COPERNICUS_VALIDATION", priority: 2, title: `Validar Copernicus para ${item.site}`, evidence: item })),
      ...rollout.map((item: any) => ({ type: "ROLLOUT_OPPORTUNITY", priority: 3, title: `Avaliar expansao em ${item.municipio}/${item.uf}`, evidence: item })),
    ].slice(0, 60),
  };
}
