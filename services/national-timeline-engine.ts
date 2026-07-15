import type { DatabaseSync } from "node:sqlite";

export function nationalTimeline(db: DatabaseSync) {
  const summary = db.prepare("SELECT COUNT(*) total,COUNT(DISTINCT site) sites,COUNT(DISTINCT municipio) municipalities,COUNT(DISTINCT uf) states,MAX(data_importacao) lastImport FROM sites").get() as Record<string, unknown>;
  const byOperator = db.prepare("SELECT operadora_origem operator,COUNT(*) records,COUNT(DISTINCT site) sites,COUNT(DISTINCT municipio) municipalities,MAX(data_importacao) lastImport FROM sites GROUP BY operadora_origem ORDER BY records DESC").all() as Record<string, unknown>[];
  const events = db.prepare("SELECT arquivo_origem,operadora,linhas_importadas,colunas_mapeadas,campos_ausentes,fallback_usado,importado_em,excel_inalterado FROM import_audit ORDER BY id DESC LIMIT 40").all() as Record<string, unknown>[];
  const importsByDate = db.prepare("SELECT COALESCE(substr(data_importacao,1,10),'sem-data') date,operadora_origem operator,COUNT(*) records,COUNT(DISTINCT site) sites FROM sites GROUP BY COALESCE(substr(data_importacao,1,10),'sem-data'),operadora_origem ORDER BY date DESC, records DESC LIMIT 80").all() as Record<string, unknown>[];
  return {
    generatedAt: new Date().toISOString(),
    summary: {
      lastImport: String(summary.lastImport || ""),
      totalRecords: Number(summary.total || 0),
      totalSites: Number(summary.sites || 0),
      totalTim: Number((byOperator.find((item) => String(item.operator).toUpperCase() === "TIM")?.records) || 0),
      totalVivo: Number((byOperator.find((item) => String(item.operator).toUpperCase() === "VIVO")?.records) || 0),
      newRecords: Number(summary.total || 0),
      monitoredMunicipalities: Number(summary.municipalities || 0),
      monitoredStates: Number(summary.states || 0),
    },
    byOperator,
    importsByDate,
    events,
  };
}

export function timelineCsvRows(db: DatabaseSync) {
  const timeline = nationalTimeline(db);
  return [
    ["SECAO", "DATA", "OPERADORA", "REGISTROS", "SITES", "DETALHE"],
    ...timeline.byOperator.map((item) => ["OPERADORA", item.lastImport, item.operator, item.records, item.sites, `${item.municipalities} municipios`]),
    ...timeline.events.map((item) => ["IMPORTACAO", item.importado_em, item.operadora, item.linhas_importadas, item.colunas_mapeadas, item.arquivo_origem]),
  ];
}
