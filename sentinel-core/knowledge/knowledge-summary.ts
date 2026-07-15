import type { DatabaseSync } from "node:sqlite";
import { SITE_SELECT } from "@/api/site-query";
import { siteRow } from "@/services/site-service";
import { neighbors } from "@/sentinel-core/graph/graph-query";
import { getRecommendations } from "@/sentinel-core/recommendation/recommendation-engine";
import { getInsights } from "@/sentinel-core/inference/inference-engine";

export function siteKnowledge(db: DatabaseSync, siteId: number) {
  const raw = db.prepare(`SELECT ${SITE_SELECT} FROM sites WHERE id=?`).get(siteId) as Record<string, unknown> | undefined;
  if (!raw) return null;
  const site = siteRow(raw);
  const trust = db.prepare("SELECT trust_score trustScore,trust_level trustLevel,trust_badge trustBadge FROM site_trust_scores WHERE site_id=? ORDER BY id DESC LIMIT 1").get(siteId);
  const copernicus = db.prepare("SELECT validation_score validationScore,evidence_level evidenceLevel,created_at createdAt FROM site_satellite_validation WHERE site_id=? ORDER BY id DESC LIMIT 1").get(siteId);
  const alerts = Number(site.geoScore || 0) >= 81 ? [{ type: "GEO_SCORE", level: "Critico", score: site.geoScore }] : [];
  return { site, trust, copernicus, alerts, recommendations: getRecommendations(db, `site:${siteId}`).recommendations.slice(0, 8), relations: neighbors(db, `SITE:${siteId}`) };
}

export function municipalityKnowledge(db: DatabaseSync, municipio: string, uf: string) {
  const summary = db.prepare("SELECT municipio,uf,COUNT(*) totalSites,COUNT(DISTINCT operadora_origem) operators,COUNT(DISTINCT tecnologia) technologies,ROUND(AVG(geo_score),1) avgGeo FROM sites WHERE municipio=? AND uf=? GROUP BY municipio,uf").get(municipio, uf);
  const operators = db.prepare("SELECT operadora_origem operator,COUNT(*) total FROM sites WHERE municipio=? AND uf=? GROUP BY operadora_origem ORDER BY total DESC").all(municipio, uf);
  const technologies = db.prepare("SELECT tecnologia,COUNT(*) total FROM sites WHERE municipio=? AND uf=? GROUP BY tecnologia ORDER BY total DESC LIMIT 20").all(municipio, uf);
  const trust = db.prepare("SELECT ROUND(AVG(t.trust_score),1) avgTrust FROM site_trust_scores t JOIN sites s ON s.id=t.site_id WHERE s.municipio=? AND s.uf=?").get(municipio, uf);
  return { summary, operators, technologies, trust, insights: getInsights(db, `municipality:${municipio}/${uf}`).insights.slice(0, 10) };
}

export function operatorKnowledge(db: DatabaseSync, operator: string) {
  const summary = db.prepare("SELECT operadora_origem operator,COUNT(*) records,COUNT(DISTINCT site) sites,COUNT(DISTINCT uf) states,COUNT(DISTINCT municipio) municipalities,COUNT(DISTINCT tecnologia) technologies FROM sites WHERE operadora_origem=? GROUP BY operadora_origem").get(operator);
  const byUf = db.prepare("SELECT uf,COUNT(*) records,COUNT(DISTINCT site) sites FROM sites WHERE operadora_origem=? GROUP BY uf ORDER BY records DESC LIMIT 30").all(operator);
  const tech = db.prepare("SELECT tecnologia,COUNT(*) records FROM sites WHERE operadora_origem=? GROUP BY tecnologia ORDER BY records DESC LIMIT 20").all(operator);
  return { summary, byUf, technologies: tech, recommendations: getRecommendations(db, `operator:${operator}`).recommendations.slice(0, 12) };
}
