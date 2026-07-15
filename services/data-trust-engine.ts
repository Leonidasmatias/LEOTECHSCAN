import type { DatabaseSync } from "node:sqlite";
import { SITE_SELECT } from "@/api/site-query";
import { siteRow } from "@/services/site-service";
import { confidenceForSite } from "@/services/confidence-engine";
import { recordAudit } from "@/services/audit-trail";

export function ensureDataTrustTables(db: DatabaseSync) {
  db.exec(`CREATE TABLE IF NOT EXISTS site_trust_scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    site_id INTEGER NOT NULL,
    site TEXT,
    trust_score INTEGER,
    trust_level TEXT,
    trust_badge TEXT,
    coordinate_confidence INTEGER,
    address_confidence INTEGER,
    municipality_confidence INTEGER,
    operator_confidence INTEGER,
    technology_confidence INTEGER,
    satellite_confidence INTEGER,
    cadastral_confidence INTEGER,
    operational_confidence INTEGER,
    overall_confidence INTEGER,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS site_validation_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    site_id INTEGER NOT NULL,
    site TEXT,
    validation_type TEXT,
    previous_score INTEGER,
    current_score INTEGER,
    status TEXT,
    recommendation TEXT,
    evidence_json TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS site_evidence_center (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    site_id INTEGER NOT NULL,
    site TEXT,
    evidence_type TEXT,
    evidence_source TEXT,
    evidence_status TEXT,
    evidence_summary TEXT,
    evidence_url TEXT,
    evidence_json TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
}

function level(score: number) {
  if (score >= 90) return { trustLevel: "Muito Alto", trustBadge: "Platinum" };
  if (score >= 75) return { trustLevel: "Alto", trustBadge: "Gold" };
  if (score >= 60) return { trustLevel: "Medio", trustBadge: "Silver" };
  if (score >= 40) return { trustLevel: "Baixo", trustBadge: "Bronze" };
  return { trustLevel: "Critico", trustBadge: "Critical" };
}

function recommendation(score: number) {
  if (score >= 90) return "Dado com alta confianca tecnica para proposta e operacao, mantendo validacao de campo quando aplicavel.";
  if (score >= 75) return "Dado confiavel, recomenda-se revisar evidencias pendentes antes de decisoes criticas.";
  if (score >= 60) return "Confianca intermediaria; complementar com revisao cadastral, mapa e operacao.";
  if (score >= 40) return "Baixa confianca; priorizar saneamento cadastral e validacao territorial.";
  return "Critico; nao usar como unica fonte para decisao operacional ou proposta sem validacao.";
}

function duplicatePenalty(db: DatabaseSync, site: ReturnType<typeof siteRow>) {
  const sameSite = Number((db.prepare("SELECT COUNT(*) total FROM sites WHERE site = ?").get(site.site) as Record<string, unknown>).total || 0);
  const sameCoord = Number((db.prepare("SELECT COUNT(*) total FROM sites WHERE ROUND(latitude,6)=ROUND(?,6) AND ROUND(longitude,6)=ROUND(?,6)").get(site.latitude, site.longitude) as Record<string, unknown>).total || 0);
  return sameSite > 1 || sameCoord > 1 ? 8 : 0;
}

export function dataTrustForSite(db: DatabaseSync, siteId: number, persist = true) {
  ensureDataTrustTables(db);
  const raw = db.prepare(`SELECT ${SITE_SELECT} FROM sites WHERE id = ?`).get(siteId) as Record<string, unknown> | undefined;
  if (!raw) return null;
  const site = siteRow(raw);
  const previous = db.prepare("SELECT trust_score trustScore FROM site_trust_scores WHERE site_id = ? ORDER BY id DESC LIMIT 1").get(site.id) as Record<string, unknown> | undefined;
  const confidence = confidenceForSite(db, site);
  const importConfidence = site.dataImportacao || site.arquivoOrigem ? 90 : 30;
  const duplicate = duplicatePenalty(db, site);
  const alertPenalty = Number(site.geoScore || 0) >= 81 ? 8 : Number(site.geoScore || 0) >= 61 ? 4 : 0;
  const trustScore = Math.max(0, Math.min(100, Math.round(confidence.overallConfidence * 0.78 + importConfidence * 0.12 + 10 - duplicate - alertPenalty)));
  const badge = level(trustScore);
  const result = {
    site,
    trustScore,
    trustLevel: badge.trustLevel,
    trustBadge: badge.trustBadge,
    recommendation: recommendation(trustScore),
    duplicateSuggestionPenalty: duplicate,
    activeAlertPenalty: alertPenalty,
    ...confidence,
  };
  if (persist) {
    db.prepare("INSERT INTO site_trust_scores (site_id,site,trust_score,trust_level,trust_badge,coordinate_confidence,address_confidence,municipality_confidence,operator_confidence,technology_confidence,satellite_confidence,cadastral_confidence,operational_confidence,overall_confidence,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)")
      .run(site.id, site.site, trustScore, badge.trustLevel, badge.trustBadge, confidence.coordinateConfidence, confidence.addressConfidence, confidence.municipalityConfidence, confidence.operatorConfidence, confidence.technologyConfidence, confidence.satelliteConfidence, confidence.cadastralConfidence, confidence.operationalConfidence, confidence.overallConfidence);
    db.prepare("INSERT INTO site_validation_history (site_id,site,validation_type,previous_score,current_score,status,recommendation,evidence_json,created_at) VALUES (?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)")
      .run(site.id, site.site, "DATA_TRUST", Number(previous?.trustScore || 0), trustScore, badge.trustLevel, result.recommendation, JSON.stringify({ confidence, duplicatePenalty: duplicate, alertPenalty }));
    recordAudit(db, "DATA_TRUST_RECALCULATED", "site", site.id, `Trust Score recalculado para ${site.site}`, { previousScore: previous?.trustScore || null, currentScore: trustScore, trustBadge: badge.trustBadge });
  }
  return result;
}

export function recalculateDataTrust(db: DatabaseSync, limit = 500) {
  ensureDataTrustTables(db);
  const ids = db.prepare("SELECT id FROM sites ORDER BY id LIMIT ?").all(limit) as Array<{ id: number }>;
  const rows = ids.map((row) => dataTrustForSite(db, row.id, true)).filter(Boolean);
  recordAudit(db, "DATA_TRUST_BATCH_RECALCULATED", "system", "data-trust", `Recalculo Data Trust executado para ${rows.length} sites`, { limit });
  return { processed: rows.length, limit };
}

export function dataTrustDashboard(db: DatabaseSync) {
  ensureDataTrustTables(db);
  const existing = Number((db.prepare("SELECT COUNT(*) total FROM site_trust_scores").get() as Record<string, unknown>).total || 0);
  if (!existing) recalculateDataTrust(db, 25);
  const summary = db.prepare("SELECT ROUND(AVG(trust_score),1) averageTrust,SUM(CASE WHEN trust_badge='Platinum' THEN 1 ELSE 0 END) platinum,SUM(CASE WHEN trust_badge='Gold' THEN 1 ELSE 0 END) gold,SUM(CASE WHEN trust_badge='Silver' THEN 1 ELSE 0 END) silver,SUM(CASE WHEN trust_badge='Bronze' THEN 1 ELSE 0 END) bronze,SUM(CASE WHEN trust_badge='Critical' THEN 1 ELSE 0 END) critical,COUNT(*) scoredSites FROM site_trust_scores").get() as Record<string, unknown>;
  const ranking = db.prepare("SELECT site_id siteId,site,trust_score trustScore,trust_level trustLevel,trust_badge trustBadge,updated_at updatedAt FROM site_trust_scores ORDER BY trust_score DESC, id DESC LIMIT 50").all();
  const low = db.prepare("SELECT site_id siteId,site,trust_score trustScore,trust_level trustLevel,trust_badge trustBadge FROM site_trust_scores WHERE trust_score < 50 ORDER BY trust_score ASC LIMIT 50").all();
  const byOperator = db.prepare("SELECT s.operadora_origem operator,ROUND(AVG(t.trust_score),1) averageTrust,COUNT(*) total FROM site_trust_scores t JOIN sites s ON s.id=t.site_id GROUP BY s.operadora_origem ORDER BY averageTrust DESC").all();
  const byUf = db.prepare("SELECT s.uf,ROUND(AVG(t.trust_score),1) averageTrust,COUNT(*) total FROM site_trust_scores t JOIN sites s ON s.id=t.site_id GROUP BY s.uf ORDER BY averageTrust DESC LIMIT 30").all();
  const criticalMissingCoordinates = db.prepare("SELECT COUNT(*) total FROM sites WHERE latitude IS NULL OR longitude IS NULL OR latitude NOT BETWEEN -34 AND 6 OR longitude NOT BETWEEN -75 AND -32").get() as Record<string, unknown>;
  return {
    summary: { ...summary, criticalMissingCoordinates: Number(criticalMissingCoordinates.total || 0) },
    ranking,
    lowConfidence: low,
    highConfidence: ranking,
    byOperator,
    byUf,
    alerts: low.slice(0, 10).map((item: any) => ({ criticidade: "ALTA", categoria: "Baixa confianca", descricao: `${item.site} com Trust Score ${item.trustScore}`, recomendacao: "Revisar cadastro, coordenadas e evidencias." })),
    governance: "Trust Score e uma estimativa tecnica; nao substitui vistoria de campo nem confirma automaticamente existencia fisica de torre.",
  };
}

export function validationHistory(db: DatabaseSync, siteId: number) {
  ensureDataTrustTables(db);
  return db.prepare("SELECT id,site_id siteId,site,validation_type validationType,previous_score previousScore,current_score currentScore,status,recommendation,evidence_json evidenceJson,created_at createdAt FROM site_validation_history WHERE site_id = ? ORDER BY id DESC LIMIT 100").all(siteId);
}

export function dataTrustCsvRows(db: DatabaseSync) {
  ensureDataTrustTables(db);
  const rows = db.prepare("SELECT site_id,site,trust_score,trust_level,trust_badge,coordinate_confidence,address_confidence,municipality_confidence,operator_confidence,technology_confidence,satellite_confidence,cadastral_confidence,operational_confidence,overall_confidence,updated_at FROM site_trust_scores ORDER BY id DESC LIMIT 1000").all() as Record<string, unknown>[];
  return [["SITE_ID","SITE","TRUST_SCORE","TRUST_LEVEL","TRUST_BADGE","COORDINATE","ADDRESS","MUNICIPALITY","OPERATOR","TECHNOLOGY","SATELLITE","CADASTRAL","OPERATIONAL","OVERALL","UPDATED_AT"], ...rows.map((row) => [row.site_id,row.site,row.trust_score,row.trust_level,row.trust_badge,row.coordinate_confidence,row.address_confidence,row.municipality_confidence,row.operator_confidence,row.technology_confidence,row.satellite_confidence,row.cadastral_confidence,row.operational_confidence,row.overall_confidence,row.updated_at])];
}

export function validationHistoryCsvRows(db: DatabaseSync) {
  ensureDataTrustTables(db);
  const rows = db.prepare("SELECT site_id,site,validation_type,previous_score,current_score,status,recommendation,created_at FROM site_validation_history ORDER BY id DESC LIMIT 1000").all() as Record<string, unknown>[];
  return [["SITE_ID","SITE","TIPO","SCORE_ANTERIOR","SCORE_ATUAL","STATUS","RECOMENDACAO","CRIADO_EM"], ...rows.map((row) => [row.site_id,row.site,row.validation_type,row.previous_score,row.current_score,row.status,row.recommendation,row.created_at])];
}
