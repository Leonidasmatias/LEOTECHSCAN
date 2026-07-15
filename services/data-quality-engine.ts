import type { DatabaseSync } from "node:sqlite";
import { text } from "@/lib/db";

export type QualityIssue = {
  id: string;
  category: string;
  severity: "critica" | "alta" | "media" | "baixa";
  label: string;
  total: number;
  sample: Array<Record<string, unknown>>;
};

const baseSample = "id,site,operadora_origem,municipio,uf,tecnologia,endereco,latitude,longitude,arquivo_origem";

function issue(db: DatabaseSync, id: string, category: string, severity: QualityIssue["severity"], label: string, where: string): QualityIssue {
  const total = Number((db.prepare(`SELECT COUNT(*) total FROM sites WHERE ${where}`).get() as Record<string, unknown>).total || 0);
  const sample = db.prepare(`SELECT ${baseSample} FROM sites WHERE ${where} ORDER BY id LIMIT 25`).all() as Record<string, unknown>[];
  return { id, category, severity, label, total, sample };
}

export function dataQualitySnapshot(db: DatabaseSync) {
  const issues = [
    issue(db, "sem-coordenadas", "Coordenadas", "critica", "Sites sem latitude ou longitude", "latitude IS NULL OR longitude IS NULL"),
    issue(db, "coordenadas-invalidas", "Coordenadas", "critica", "Coordenadas fora do Brasil ou zeradas", "latitude IS NOT NULL AND longitude IS NOT NULL AND (latitude NOT BETWEEN -34 AND 6 OR longitude NOT BETWEEN -75 AND -32 OR (latitude = 0 AND longitude = 0))"),
    issue(db, "sem-endereco", "Cadastro", "alta", "Sites sem endereco", "endereco IS NULL OR TRIM(endereco) = ''"),
    issue(db, "sem-municipio", "Cadastro", "alta", "Sites sem municipio", "municipio IS NULL OR TRIM(municipio) = ''"),
    issue(db, "sem-uf", "Cadastro", "alta", "Sites sem UF", "uf IS NULL OR TRIM(uf) = ''"),
    issue(db, "sem-tecnologia", "Tecnologia", "media", "Sites sem tecnologia", "tecnologia IS NULL OR TRIM(tecnologia) = ''"),
    issue(db, "dados-incompletos", "Completude", "media", "Registros com campos principais incompletos", "(site IS NULL OR TRIM(site) = '' OR operadora_origem IS NULL OR TRIM(operadora_origem) = '' OR municipio IS NULL OR TRIM(municipio) = '' OR uf IS NULL OR TRIM(uf) = '' OR tecnologia IS NULL OR TRIM(tecnologia) = '')"),
    issue(db, "uf-estado-inconsistente", "Consistencia", "baixa", "UF divergente do campo estado", "uf IS NOT NULL AND estado IS NOT NULL AND TRIM(uf) <> '' AND TRIM(estado) <> '' AND uf <> estado"),
  ];
  const totalRecords = Number((db.prepare("SELECT COUNT(*) total FROM sites").get() as Record<string, unknown>).total || 0);
  const affected = issues.reduce((sum, item) => sum + item.total, 0);
  return {
    generatedAt: new Date().toISOString(),
    summary: {
      totalRecords,
      totalIssues: affected,
      issueTypes: issues.filter((item) => item.total > 0).length,
      qualityScore: totalRecords ? Math.max(0, Number((100 - (affected / totalRecords) * 100).toFixed(1))) : 100,
    },
    issues,
    byOperator: db.prepare("SELECT operadora_origem operator,COUNT(*) records,SUM(CASE WHEN latitude IS NULL OR longitude IS NULL THEN 1 ELSE 0 END) missingCoordinates,SUM(CASE WHEN endereco IS NULL OR TRIM(endereco) = '' THEN 1 ELSE 0 END) missingAddress,SUM(CASE WHEN tecnologia IS NULL OR TRIM(tecnologia) = '' THEN 1 ELSE 0 END) missingTechnology FROM sites GROUP BY operadora_origem ORDER BY records DESC").all(),
    byUf: db.prepare("SELECT COALESCE(uf,'Nao informado') uf,COUNT(*) records,SUM(CASE WHEN latitude IS NULL OR longitude IS NULL THEN 1 ELSE 0 END) missingCoordinates,SUM(CASE WHEN endereco IS NULL OR TRIM(endereco) = '' THEN 1 ELSE 0 END) missingAddress FROM sites GROUP BY uf ORDER BY missingCoordinates DESC, records DESC LIMIT 30").all(),
  };
}

export function qualityCsvRows(db: DatabaseSync) {
  const snapshot = dataQualitySnapshot(db);
  return [["ID", "CATEGORIA", "SEVERIDADE", "DESCRICAO", "TOTAL"], ...snapshot.issues.map((item) => [item.id, item.category, item.severity, item.label, item.total])];
}

export function normalizeAddress(value: unknown) {
  return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}
