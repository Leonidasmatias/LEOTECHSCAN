import type { DatabaseSync } from "node:sqlite";
import { SITE_SELECT } from "@/api/site-query";
import { siteRow } from "@/services/site-service";
import { getSiteNotes } from "@/services/site-notes";
import { copernicusForSite } from "@/services/copernicus-engine";
import { dataTrustForSite, ensureDataTrustTables, validationHistory } from "@/services/data-trust-engine";
import { recordAudit } from "@/services/audit-trail";

export function evidenceCenterForSite(db: DatabaseSync, siteId: number, persist = true) {
  ensureDataTrustTables(db);
  const raw = db.prepare(`SELECT ${SITE_SELECT} FROM sites WHERE id = ?`).get(siteId) as Record<string, unknown> | undefined;
  if (!raw) return null;
  const site = siteRow(raw);
  const trust = dataTrustForSite(db, siteId, persist);
  const copernicus = copernicusForSite(db, siteId, undefined, undefined, persist);
  const notes = getSiteNotes(db, siteId);
  const history = validationHistory(db, siteId);
  const googleMaps = `https://maps.google.com/?q=${site.latitude},${site.longitude}`;
  const evidences = [
    { type: "CADASTRO", source: site.arquivoOrigem, status: "Disponivel", summary: `${site.site} - ${site.operadoraOrigem} - ${site.municipio}/${site.uf}` },
    { type: "COORDENADAS", source: "SQLite sites", status: trust?.coordinateConfidence ? "Validado" : "Pendente", summary: `${site.latitude}, ${site.longitude}` },
    { type: "COPERNICUS", source: "Sentinel-1 metadata_only", status: copernicus?.validation.evidenceLevel || "Pendente", summary: copernicus?.recommendation || "Sem evidencia" },
    { type: "QUALIDADE", source: "Data Trust Engine", status: trust?.trustBadge || "Pendente", summary: `Trust Score ${trust?.trustScore ?? 0}` },
    { type: "OBSERVACOES", source: "site_notes", status: notes.length ? "Disponivel" : "Sem observacoes", summary: `${notes.length} observacoes locais` },
  ];
  if (persist) {
    const insert = db.prepare("INSERT INTO site_evidence_center (site_id,site,evidence_type,evidence_source,evidence_status,evidence_summary,evidence_url,evidence_json,created_at) VALUES (?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)");
    for (const evidence of evidences) insert.run(site.id, site.site, evidence.type, evidence.source, evidence.status, evidence.summary, evidence.type === "COORDENADAS" ? googleMaps : "", JSON.stringify(evidence));
    recordAudit(db, "EVIDENCE_CENTER_OPENED", "site", site.id, `Evidence Center consultado para ${site.site}`, { trustScore: trust?.trustScore, evidenceCount: evidences.length });
  }
  return {
    site,
    googleMaps,
    trust,
    copernicus,
    notes,
    history,
    evidences,
    technicalRecommendation: trust?.recommendation || "Gerar validacao de confianca antes de decisao tecnica.",
    governance: "Dossie tecnico e evidencia de apoio; nao substitui vistoria de campo nem confirma automaticamente existencia fisica da torre.",
  };
}

export function evidenceCenterCsvRows(db: DatabaseSync) {
  ensureDataTrustTables(db);
  const rows = db.prepare("SELECT site_id,site,evidence_type,evidence_source,evidence_status,evidence_summary,evidence_url,created_at FROM site_evidence_center ORDER BY id DESC LIMIT 1000").all() as Record<string, unknown>[];
  return [["SITE_ID","SITE","TIPO","FONTE","STATUS","RESUMO","URL","CRIADO_EM"], ...rows.map((row) => [row.site_id,row.site,row.evidence_type,row.evidence_source,row.evidence_status,row.evidence_summary,row.evidence_url,row.created_at])];
}

export function dossierLines(dossier: NonNullable<ReturnType<typeof evidenceCenterForSite>>) {
  return [
    `Site: ${dossier.site.site}`,
    `Operadora: ${dossier.site.operadoraOrigem}`,
    `Municipio/UF: ${dossier.site.municipio}/${dossier.site.uf}`,
    `Endereco: ${dossier.site.endereco}`,
    `Coordenadas: ${dossier.site.latitude}, ${dossier.site.longitude}`,
    `Google Maps: ${dossier.googleMaps}`,
    `Trust Score: ${dossier.trust?.trustScore} (${dossier.trust?.trustBadge})`,
    `Copernicus: ${dossier.copernicus?.validation.evidenceLevel} - ${dossier.copernicus?.validation.validationScore}`,
    `Recomendacao: ${dossier.technicalRecommendation}`,
    `Governanca: ${dossier.governance}`,
  ];
}
