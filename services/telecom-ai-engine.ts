import type { DatabaseSync } from "node:sqlite";
import rules from "@/config/sentinel_rules.json";
import { getStrategicMunicipalities } from "@/services/strategic-data";

export type TelecomAiAnswer = {
  intent: string;
  question: string;
  answer: string;
  rows: Array<Record<string, unknown>>;
};

function norm(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function table(rows: Array<Record<string, unknown>>, label: string) {
  return rows.map((row, index) => ({ posicao: index + 1, ...row, indicador: label }));
}

export function answerTelecomQuestion(db: DatabaseSync, question: string): TelecomAiAnswer {
  const q = norm(question || "gerar resumo executivo nacional");
  const municipalities = getStrategicMunicipalities(db);
  const limit = rules.telecomAi.maxRows;
  if (q.includes("sem 5g") || q.includes("nao possuem 5g")) {
    const rows = table(municipalities.filter((item) => !item.has5g).sort((a, b) => b.opi - a.opi).slice(0, limit), "Sem 5G");
    return { intent: "municipios_sem_5g", question, answer: `${rows.length} municipios prioritarios sem 5G encontrados na amostra principal.`, rows };
  }
  if (q.includes("apenas uma operadora") || q.includes("uma operadora")) {
    const rows = table(municipalities.filter((item) => item.operators === 1).sort((a, b) => b.sri.score - a.sri.score).slice(0, limit), "Operadora unica");
    return { intent: "municipios_operadora_unica", question, answer: "Municipios com baixa redundancia competitiva listados por risco.", rows };
  }
  if (q.includes("vivo")) {
    const rows = db.prepare("SELECT municipio,uf,COUNT(*) registros,COUNT(DISTINCT site) sites FROM sites WHERE operadora_origem='VIVO' GROUP BY uf,municipio ORDER BY registros DESC LIMIT ?").all(limit) as Record<string, unknown>[];
    return { intent: "municipios_vivo", question, answer: "Municipios com presenca VIVO ordenados por registros.", rows };
  }
  if (q.includes("tim")) {
    const rows = db.prepare("SELECT municipio,uf,COUNT(*) registros,COUNT(DISTINCT site) sites FROM sites WHERE operadora_origem='TIM' GROUP BY uf,municipio ORDER BY registros DESC LIMIT ?").all(limit) as Record<string, unknown>[];
    return { intent: "municipios_tim", question, answer: "Municipios com presenca TIM ordenados por registros.", rows };
  }
  if (q.includes("opportunity") || q.includes("expansao") || q.includes("prioritarios")) {
    const rows = table([...municipalities].sort((a, b) => b.opi - a.opi).slice(0, limit), "OPI");
    return { intent: "ranking_opi", question, answer: "Municipios prioritarios para expansao ordenados por OPI.", rows };
  }
  if (q.includes("leonidas") || q.includes("lts")) {
    const rows = table([...municipalities].sort((a, b) => b.lts.score - a.lts.score).slice(0, limit), "LTS");
    return { intent: "ranking_lts", question, answer: "Municipios com maior Leonidas Telecom Score.", rows };
  }
  if (q.includes("estado") || q.includes("uf")) {
    const rows = db.prepare("SELECT uf,COUNT(*) registros,COUNT(DISTINCT site) sites,COUNT(DISTINCT municipio) municipios FROM sites GROUP BY uf ORDER BY registros DESC LIMIT ?").all(limit) as Record<string, unknown>[];
    return { intent: "ranking_estados", question, answer: "Estados com maior concentracao de sites.", rows };
  }
  if (q.includes("baixa cobertura")) {
    const rows = table(municipalities.filter((item) => item.sites <= rules.telecomAi.lowCoverageSiteThreshold).sort((a, b) => b.sri.score - a.sri.score).slice(0, limit), "Baixa cobertura");
    return { intent: "baixa_cobertura", question, answer: "Municipios com baixa cobertura e risco elevado.", rows };
  }
  const summary = db.prepare("SELECT COUNT(*) registros,COUNT(DISTINCT site) sites,COUNT(DISTINCT operadora_origem) operadoras,COUNT(DISTINCT municipio) municipios,COUNT(DISTINCT uf) ufs FROM sites").get() as Record<string, unknown>;
  const rows = [summary, ...table([...municipalities].sort((a, b) => b.records - a.records).slice(0, 5), "Top municipios")];
  return { intent: "resumo_executivo", question, answer: `Resumo nacional: ${summary.sites} sites em ${summary.municipios} municipios e ${summary.operadoras} operadoras.`, rows };
}
