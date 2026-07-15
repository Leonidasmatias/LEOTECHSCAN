import type { DatabaseSync } from "node:sqlite";

export function marketSnapshot(db: DatabaseSync) {
  const operators = db.prepare("SELECT operadora_origem operator,COUNT(*) records,COUNT(DISTINCT site) sites,COUNT(DISTINCT uf) states,COUNT(DISTINCT municipio) municipalities,COUNT(DISTINCT tecnologia) technologies FROM sites GROUP BY operadora_origem ORDER BY records DESC").all() as Record<string, unknown>[];
  const byUf = db.prepare("SELECT uf,operadora_origem operator,COUNT(*) records,COUNT(DISTINCT site) sites FROM sites GROUP BY uf,operadora_origem ORDER BY uf,records DESC").all() as Record<string, unknown>[];
  const byTechnology = db.prepare("SELECT tecnologia,operadora_origem operator,COUNT(*) records FROM sites GROUP BY tecnologia,operadora_origem ORDER BY records DESC LIMIT 80").all() as Record<string, unknown>[];
  const comparisons = {
    maiorCobertura: operators.slice().sort((a, b) => Number(b.states) - Number(a.states))[0],
    maiorDensidade: operators[0],
    maiorPresenca: operators.slice().sort((a, b) => Number(b.municipalities) - Number(a.municipalities))[0],
    maiorCrescimento: operators[0],
  };
  return { operators, byUf, byTechnology, comparisons };
}
