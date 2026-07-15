import type { DatabaseSync } from "node:sqlite";
import { ensureGraphTables } from "@/sentinel-core/graph/graph-store";
import { insightRules } from "@/sentinel-core/inference/insight-rules";

export function runInference(db: DatabaseSync) {
  ensureGraphTables(db);
  db.exec("DELETE FROM sig_insights");
  const insights: Array<Record<string, unknown>> = [];
  const lowTrust = db.prepare("SELECT site_id,site,trust_score FROM site_trust_scores WHERE trust_score < ? ORDER BY trust_score ASC LIMIT 25").all(insightRules.lowTrustThreshold) as Record<string, unknown>[];
  for (const item of lowTrust) insights.push({
    insightType: "LOW_TRUST_SITE",
    scopeType: "SITE",
    scopeId: item.site_id,
    title: `Site com baixa confianca: ${item.site}`,
    description: `Trust Score ${item.trust_score}. Revisar cadastro, coordenadas e evidencias.`,
    score: 100 - Number(item.trust_score || 0),
    recommendation: "Priorizar validacao tecnica e dossie de evidencias.",
    evidence: item,
  });
  const noCopernicus = db.prepare("SELECT s.id,s.site FROM sites s LEFT JOIN site_satellite_validation v ON v.site_id=s.id WHERE v.id IS NULL AND s.latitude BETWEEN -34 AND 6 AND s.longitude BETWEEN -75 AND -32 LIMIT 25").all() as Record<string, unknown>[];
  for (const item of noCopernicus) insights.push({
    insightType: "MISSING_COPERNICUS",
    scopeType: "SITE",
    scopeId: item.id,
    title: `Site sem evidencia Copernicus: ${item.site}`,
    description: "Coordenada valida, mas sem validacao Sentinel-1 metadata registrada.",
    score: 65,
    recommendation: "Executar validacao Copernicus metadata-only.",
    evidence: item,
  });
  const dominance = db.prepare("SELECT uf,operadora_origem operator,COUNT(*) records FROM sites GROUP BY uf,operadora_origem HAVING records > 1000 ORDER BY records DESC LIMIT 20").all() as Record<string, unknown>[];
  for (const item of dominance.slice(0, 10)) insights.push({
    insightType: "OPERATOR_CONCENTRATION",
    scopeType: "STATE",
    scopeId: item.uf,
    title: `Concentracao operacional em ${item.uf}`,
    description: `${item.operator} possui ${item.records} registros na UF.`,
    score: 60,
    recommendation: "Avaliar competicao, cobertura e oportunidades multioperadora.",
    evidence: item,
  });
  const insert = db.prepare("INSERT INTO sig_insights (insight_type,scope_type,scope_id,title,description,score,recommendation,evidence_json,created_at) VALUES (?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)");
  for (const item of insights) insert.run(String(item.insightType), String(item.scopeType), String(item.scopeId), String(item.title), String(item.description), Number(item.score || 0), String(item.recommendation), JSON.stringify(item.evidence));
  return insights;
}

export function getInsights(db: DatabaseSync, scope = "global") {
  ensureGraphTables(db);
  const rows = db.prepare("SELECT insight_type insightType,scope_type scopeType,scope_id scopeId,title,description,score,recommendation,evidence_json evidenceJson,created_at createdAt FROM sig_insights ORDER BY score DESC,id DESC LIMIT 100").all();
  return { scope, insights: rows };
}
