import type { DatabaseSync } from "node:sqlite";
import { normalizeAddress } from "@/services/data-quality-engine";

export type DuplicateCandidate = {
  type: string;
  severity: "alta" | "media" | "baixa";
  key: string;
  total: number;
  sample: Array<Record<string, unknown>>;
  recommendation: string;
};

function sample(db: DatabaseSync, where: string, values: Array<string | number | null>) {
  return db.prepare(`SELECT id,site,operadora_origem,municipio,uf,endereco,latitude,longitude,tecnologia FROM sites WHERE ${where} ORDER BY id LIMIT 5`).all(...values) as Record<string, unknown>[];
}

export function duplicateCandidates(db: DatabaseSync) {
  const candidates: DuplicateCandidate[] = [];
  const sameSite = db.prepare("SELECT site key,COUNT(*) total FROM sites WHERE site IS NOT NULL AND TRIM(site) <> '' GROUP BY site HAVING COUNT(*) > 1 ORDER BY total DESC LIMIT 25").all() as Record<string, unknown>[];
  sameSite.forEach((row) => candidates.push({
    type: "mesma_sigla",
    severity: "alta",
    key: String(row.key),
    total: Number(row.total),
    sample: sample(db, "site = ?", [String(row.key)]),
    recommendation: "Conferir se a sigla representa registros historicos, tecnologias distintas ou duplicidade cadastral.",
  }));

  const sameCoord = db.prepare("SELECT ROUND(latitude,6)||','||ROUND(longitude,6) key,COUNT(*) total FROM sites WHERE latitude BETWEEN -34 AND 6 AND longitude BETWEEN -75 AND -32 GROUP BY ROUND(latitude,6),ROUND(longitude,6) HAVING COUNT(*) > 1 ORDER BY total DESC LIMIT 25").all() as Record<string, unknown>[];
  sameCoord.forEach((row) => {
    const [lat, lon] = String(row.key).split(",");
    candidates.push({
      type: "mesma_coordenada",
      severity: "alta",
      key: String(row.key),
      total: Number(row.total),
      sample: sample(db, "ROUND(latitude,6) = ? AND ROUND(longitude,6) = ?", [Number(lat), Number(lon)]),
      recommendation: "Validar compartilhamento de estrutura ou duplicidade de ponto geografico.",
    });
  });

  const closeCoord = db.prepare("SELECT ROUND(latitude,3)||','||ROUND(longitude,3) key,COUNT(*) total FROM sites WHERE latitude BETWEEN -34 AND 6 AND longitude BETWEEN -75 AND -32 GROUP BY ROUND(latitude,3),ROUND(longitude,3) HAVING COUNT(*) BETWEEN 2 AND 50 ORDER BY total DESC LIMIT 25").all() as Record<string, unknown>[];
  closeCoord.forEach((row) => {
    const [lat, lon] = String(row.key).split(",");
    candidates.push({
      type: "coordenadas_proximas",
      severity: "media",
      key: String(row.key),
      total: Number(row.total),
      sample: sample(db, "ROUND(latitude,3) = ? AND ROUND(longitude,3) = ?", [Number(lat), Number(lon)]),
      recommendation: "Comparar distancia real e endereco antes de qualquer decisao operacional.",
    });
  });

  const addressRows = db.prepare("SELECT municipio,uf,endereco,COUNT(*) total FROM sites WHERE endereco IS NOT NULL AND TRIM(endereco) <> '' GROUP BY municipio,uf,endereco HAVING COUNT(*) > 1 ORDER BY total DESC LIMIT 25").all() as Record<string, unknown>[];
  addressRows.forEach((row) => candidates.push({
    type: "mesmo_endereco",
    severity: "media",
    key: `${row.municipio}/${row.uf} - ${normalizeAddress(row.endereco)}`,
    total: Number(row.total),
    sample: sample(db, "municipio = ? AND uf = ? AND endereco = ?", [String(row.municipio), String(row.uf), String(row.endereco)]),
    recommendation: "Verificar se sao tecnologias co-localizadas ou repeticao cadastral.",
  }));

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      totalCandidates: candidates.length,
      high: candidates.filter((item) => item.severity === "alta").length,
      medium: candidates.filter((item) => item.severity === "media").length,
      low: candidates.filter((item) => item.severity === "baixa").length,
    },
    candidates: candidates.slice(0, 100),
  };
}

export function duplicatesCsvRows(db: DatabaseSync) {
  const snapshot = duplicateCandidates(db);
  return [["TIPO", "SEVERIDADE", "CHAVE", "TOTAL", "RECOMENDACAO"], ...snapshot.candidates.map((item) => [item.type, item.severity, item.key, item.total, item.recommendation])];
}
