import { NextRequest, NextResponse } from "next/server";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { once } from "node:events";
import { Readable } from "node:stream";
import { getDb, getWritableDb } from "@/lib/db";
import { whereFrom, withClause } from "@/lib/filters";
import { getOperatorMetrics } from "@/lib/operator";
import { csvRows } from "@/utils/csv";
import { sanitizeFilenameSegment, resolveExportPath } from "@/lib/export-path";
import { simplePdf } from "@/utils/pdf";
import { SITE_SELECT } from "@/api/site-query";
import { siteRow } from "@/services/site-service";
import { answerTelecomQuestion } from "@/services/telecom-ai-engine";
import { rolloutRows } from "@/services/rollout-engine";
import { alertRows } from "@/services/alert-engine";
import { marketSnapshot } from "@/services/market-engine";
import { qualityCsvRows } from "@/services/data-quality-engine";
import { duplicatesCsvRows } from "@/services/duplicates-engine";
import { timelineCsvRows } from "@/services/national-timeline-engine";
import { digitalTwinSite, geointelligence, scenarioPlanner, strategicPlanning } from "@/services/enterprise-v3-engine";
import { copernicusCsvRows, copernicusEvidenceRows, copernicusForSite } from "@/services/copernicus-engine";
import { dataTrustCsvRows, validationHistoryCsvRows } from "@/services/data-trust-engine";
import { evidenceCenterCsvRows } from "@/services/evidence-center-engine";
import { auditTrailRows, recordAudit } from "@/services/audit-trail";
import { getRecommendations } from "@/sentinel-core/recommendation/recommendation-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const columns = ["SITE_ID", "MUNICIPIO", "UF", "TECNOLOGIA", "STATUS", "DETENTOR_INFRA", "TIPO_DE_INFRA", "ALTURA", "LATITUDE", "LONGITUDE", "GEO_SCORE", "RISCO"];

function csv(value: unknown) {
  const text = String(value ?? "").replace(/\r?\n/g, " ");
  return `"${text.replace(/"/g, '""')}"`;
}

function stamp() {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "");
}

// STAGE 0 — WP0.5 Export Path Protection (audit-v4 risk R7).
// sanitizeFilenameSegment / resolveExportPath now live in lib/export-path.ts (WP0.10) so
// they can be unit tested directly, since Next.js route.ts files may only export HTTP
// method handlers and a small set of config constants. Behavior is unchanged, only the
// definitions moved.

export async function GET(request: NextRequest) {
  const kind = request.nextUrl.searchParams.get("type");
  if (!["ranking", "critical", "executive", "operator-intelligence", "ori-ranking", "tci-ranking", "mission-control-csv", "mission-control-pdf", "site-csv", "site-pdf", "telecom-ai-report", "rollout-intelligence", "market-intelligence", "alert-center", "municipios-prioritarios", "qualidade-cadastral", "possiveis-duplicidades", "timeline-nacional", "digital-twin-sites", "strategic-planning", "scenario-planner", "advanced-geointelligence", "copernicus-validation", "copernicus-evidence", "data-trust-scores", "site-validation-history", "telecom-evidence-center", "audit-trail", "sentinel-graph-nodes", "sentinel-graph-edges", "sentinel-graph-insights", "sentinel-graph-recommendations"].includes(kind || "")) {
    return NextResponse.json({ error: "Tipo de exportação inválido." }, { status: 400 });
  }
  try {
    const db = getDb();
    const { clauses, sql, values } = whereFrom(request.nextUrl.searchParams);
    const where = kind === "critical" ? withClause(clauses, "geo_score >= 81") : sql;
    const prefix = kind === "critical" ? "sites-criticos" : kind === "executive" ? "executive-report" : kind === "operator-intelligence" ? "operator-intelligence" : kind === "ori-ranking" ? "ori-ranking" : kind === "tci-ranking" ? "tci-ranking" : "ranking-geo-score";
    const filename = `${prefix}-${stamp()}.csv`;
    const exportDir = path.resolve(process.cwd(), "..", "EXPORTACOES");
    await mkdir(exportDir, { recursive: true });
    const filePath = resolveExportPath(exportDir, filename);
    if (kind === "telecom-ai-report") {
      const answer = answerTelecomQuestion(db, request.nextUrl.searchParams.get("q") || "Gerar resumo executivo nacional");
      const report = [["INTENT", answer.intent], ["RESPOSTA", answer.answer], [], ["DADOS", "JSON"], ...answer.rows.map((row) => ["ROW", JSON.stringify(row)])];
      const aiFile = resolveExportPath(exportDir, "telecom_ai_report.csv");
      await writeFile(aiFile, csvRows(report), { encoding: "utf8" });
      return new NextResponse(Readable.toWeb(createReadStream(aiFile)) as ReadableStream, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="telecom_ai_report.csv"` } });
    }
    if (kind === "rollout-intelligence" || kind === "municipios-prioritarios") {
      const rows = rolloutRows(db).slice(0, kind === "municipios-prioritarios" ? 100 : 500);
      const report = [["MUNICIPIO", "UF", "OPI", "LTS", "TCI", "SITES_ATUAIS", "NOVOS_SITES", "EQUIPES", "MOS", "INSTALACOES", "PRIORIDADE"], ...rows.map((row) => [row.municipio, row.uf, row.opportunityIndex, row.lts, row.tci, row.sitesAtuais, row.novosSitesEstimados, row.equipesEstimadas, row.mosEstimados, row.instalacoesEstimadas, row.prioridade])];
      const out = resolveExportPath(exportDir, kind === "municipios-prioritarios" ? "municipios_prioritarios.csv" : "rollout_intelligence.csv");
      await writeFile(out, csvRows(report), { encoding: "utf8" });
      return new NextResponse(Readable.toWeb(createReadStream(out)) as ReadableStream, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${path.basename(out)}"` } });
    }
    if (kind === "alert-center") {
      const rows = alertRows(db);
      const report = [["CRITICIDADE", "DATA", "ORIGEM", "CATEGORIA", "DESCRICAO", "RECOMENDACAO"], ...rows.map((row) => [row.criticidade, row.data, row.origem, row.categoria, row.descricao, row.recomendacao])];
      const out = resolveExportPath(exportDir, "alert_center.csv");
      await writeFile(out, csvRows(report), { encoding: "utf8" });
      return new NextResponse(Readable.toWeb(createReadStream(out)) as ReadableStream, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="alert_center.csv"` } });
    }
    if (kind === "market-intelligence") {
      const market = marketSnapshot(db);
      const report = [["SECAO", "OPERADORA", "REGISTROS", "SITES", "UF", "MUNICIPIOS"], ...market.operators.map((row) => ["OPERADORA", row.operator, row.records, row.sites, row.states, row.municipalities])];
      const out = resolveExportPath(exportDir, "market_intelligence.csv");
      await writeFile(out, csvRows(report), { encoding: "utf8" });
      return new NextResponse(Readable.toWeb(createReadStream(out)) as ReadableStream, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="market_intelligence.csv"` } });
    }
    if (kind === "qualidade-cadastral" || kind === "possiveis-duplicidades" || kind === "timeline-nacional") {
      const report = kind === "qualidade-cadastral" ? qualityCsvRows(db) : kind === "possiveis-duplicidades" ? duplicatesCsvRows(db) : timelineCsvRows(db);
      const filename = kind === "qualidade-cadastral" ? "qualidade_cadastral.csv" : kind === "possiveis-duplicidades" ? "possiveis_duplicidades.csv" : "timeline_nacional.csv";
      const out = resolveExportPath(exportDir, filename);
      await writeFile(out, csvRows(report), { encoding: "utf8" });
      return new NextResponse(Readable.toWeb(createReadStream(out)) as ReadableStream, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}"` } });
    }
    if (kind === "digital-twin-sites" || kind === "strategic-planning" || kind === "scenario-planner" || kind === "advanced-geointelligence") {
      const id = Number(request.nextUrl.searchParams.get("id") || 1);
      const planInput = { operadora: request.nextUrl.searchParams.get("operadora") || "VIVO", uf: request.nextUrl.searchParams.get("uf") || "SP", tecnologia: request.nextUrl.searchParams.get("tecnologia") || "5G", metaNovosSites: Number(request.nextUrl.searchParams.get("meta") || 100), horizonteDias: Number(request.nextUrl.searchParams.get("horizonte") || 120) };
      const v3Db = kind === "digital-twin-sites" || kind === "advanced-geointelligence" ? getWritableDb() : db;
      const data = kind === "digital-twin-sites" ? digitalTwinSite(v3Db, id) : kind === "strategic-planning" ? strategicPlanning(v3Db, planInput) : kind === "scenario-planner" ? scenarioPlanner(v3Db, planInput) : geointelligence(v3Db, id, Number(request.nextUrl.searchParams.get("radiusKm") || 30));
      const rows = [["SECAO", "CHAVE", "VALOR"], ...Object.entries(data || {}).map(([key, value]) => ["ENTERPRISE_V3", key, typeof value === "object" ? JSON.stringify(value) : String(value)])];
      const filename = kind === "digital-twin-sites" ? "digital_twin_sites.csv" : kind === "strategic-planning" ? "strategic_planning.csv" : kind === "scenario-planner" ? "scenario_planner.csv" : "advanced_geointelligence.csv";
      const out = resolveExportPath(exportDir, filename);
      await writeFile(out, csvRows(rows), { encoding: "utf8" });
      return new NextResponse(Readable.toWeb(createReadStream(out)) as ReadableStream, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}"` } });
    }
    if (kind === "copernicus-validation" || kind === "copernicus-evidence") {
      const v3Db = getWritableDb();
      const id = Number(request.nextUrl.searchParams.get("id") || 1);
      copernicusForSite(v3Db, id, undefined, undefined, true);
      const report = kind === "copernicus-validation" ? copernicusCsvRows(v3Db) : copernicusEvidenceRows(v3Db);
      const filename = kind === "copernicus-validation" ? "copernicus_site_validation.csv" : "copernicus_satellite_evidence.csv";
      const out = resolveExportPath(exportDir, filename);
      await writeFile(out, csvRows(report), { encoding: "utf8" });
      return new NextResponse(Readable.toWeb(createReadStream(out)) as ReadableStream, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}"` } });
    }
    if (kind === "data-trust-scores" || kind === "site-validation-history" || kind === "telecom-evidence-center" || kind === "audit-trail") {
      const trustDb = getWritableDb();
      const report = kind === "data-trust-scores" ? dataTrustCsvRows(trustDb)
        : kind === "site-validation-history" ? validationHistoryCsvRows(trustDb)
          : kind === "telecom-evidence-center" ? evidenceCenterCsvRows(trustDb)
            : [["ID","EVENT_TYPE","ENTITY_TYPE","ENTITY_ID","DESCRIPTION","METADATA","CREATED_AT"], ...auditTrailRows(trustDb, 1000).map((row: any) => [row.id,row.eventType,row.entityType,row.entityId,row.description,row.metadataJson,row.createdAt])];
      const filename = kind === "data-trust-scores" ? "data_trust_scores.csv" : kind === "site-validation-history" ? "site_validation_history.csv" : kind === "telecom-evidence-center" ? "telecom_evidence_center.csv" : "audit_trail.csv";
      const out = resolveExportPath(exportDir, filename);
      await writeFile(out, csvRows(report), { encoding: "utf8" });
      recordAudit(trustDb, "EXPORT_CREATED", "system", kind, `Exportacao ${filename} gerada`, { kind, filename });
      return new NextResponse(Readable.toWeb(createReadStream(out)) as ReadableStream, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}"` } });
    }
    if (kind === "sentinel-graph-nodes" || kind === "sentinel-graph-edges" || kind === "sentinel-graph-insights" || kind === "sentinel-graph-recommendations") {
      const sigDb = getWritableDb();
      const rows = kind === "sentinel-graph-nodes"
        ? [["NODE_ID","NODE_TYPE","LABEL","REF_TABLE","REF_ID","ATTRIBUTES"], ...(sigDb.prepare("SELECT node_id,node_type,label,ref_table,ref_id,attributes_json FROM sig_nodes ORDER BY id LIMIT 5000").all() as Record<string, unknown>[]).map((r) => [r.node_id,r.node_type,r.label,r.ref_table,r.ref_id,r.attributes_json])]
        : kind === "sentinel-graph-edges"
          ? [["EDGE_ID","SOURCE","TARGET","RELATION","WEIGHT","ATTRIBUTES"], ...(sigDb.prepare("SELECT edge_id,source_node_id,target_node_id,relation_type,weight,attributes_json FROM sig_edges ORDER BY id LIMIT 10000").all() as Record<string, unknown>[]).map((r) => [r.edge_id,r.source_node_id,r.target_node_id,r.relation_type,r.weight,r.attributes_json])]
          : kind === "sentinel-graph-insights"
            ? [["TYPE","SCOPE","TITLE","SCORE","RECOMMENDATION"], ...(sigDb.prepare("SELECT insight_type,scope_type,title,score,recommendation FROM sig_insights ORDER BY score DESC LIMIT 1000").all() as Record<string, unknown>[]).map((r) => [r.insight_type,r.scope_type,r.title,r.score,r.recommendation])]
            : [["TYPE","PRIORITY","TITLE","EVIDENCE"], ...getRecommendations(sigDb, "global").recommendations.map((r: any) => [r.type, r.priority, r.title, JSON.stringify(r.evidence || {})])];
      const filename = kind === "sentinel-graph-nodes" ? "sentinel_graph_nodes.csv" : kind === "sentinel-graph-edges" ? "sentinel_graph_edges.csv" : kind === "sentinel-graph-insights" ? "sentinel_graph_insights.csv" : "sentinel_graph_recommendations.csv";
      const out = resolveExportPath(exportDir, filename);
      await writeFile(out, csvRows(rows), { encoding: "utf8" });
      return new NextResponse(Readable.toWeb(createReadStream(out)) as ReadableStream, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}"` } });
    }
    if (kind === "mission-control-csv") {
      const report: unknown[][] = [["SECAO", "INDICADOR", "VALOR"]];
      const summary = db.prepare("SELECT COUNT(*) records,COUNT(DISTINCT site) sites,COUNT(DISTINCT operadora_origem) operators,COUNT(DISTINCT municipio) municipalities,COUNT(DISTINCT uf) states FROM sites").get() as Record<string, unknown>;
      Object.entries(summary).forEach(([key, value]) => report.push(["MISSION_CONTROL", key, value]));
      (db.prepare("SELECT operadora_origem,COUNT(*) records,COUNT(DISTINCT site) sites FROM sites GROUP BY operadora_origem ORDER BY records DESC").all() as Record<string, unknown>[]).forEach((item) => report.push(["OPERADORA", item.operadora_origem, `${item.records} registros / ${item.sites} sites`]));
      const content = csvRows(report);
      const missionFile = resolveExportPath(exportDir, `mission-control-${stamp()}.csv`);
      await writeFile(missionFile, content, { encoding: "utf8", flag: "wx" });
      return new NextResponse(Readable.toWeb(createReadStream(missionFile)) as ReadableStream, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${path.basename(missionFile)}"` } });
    }
    if (kind === "mission-control-pdf") {
      const summary = db.prepare("SELECT COUNT(*) records,COUNT(DISTINCT site) sites,COUNT(DISTINCT operadora_origem) operators,COUNT(DISTINCT municipio) municipalities,COUNT(DISTINCT uf) states FROM sites").get() as Record<string, unknown>;
      const lines = [`Sites: ${summary.sites}`, `Registros: ${summary.records}`, `Operadoras: ${summary.operators}`, `Municipios: ${summary.municipalities}`, `UFs: ${summary.states}`, "Sprint 2A - Mission Control"];
      const pdf = simplePdf("Sentinel-1 Mission Control", lines);
      return new NextResponse(pdf, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="mission-control-${stamp()}.pdf"` } });
    }
    if (kind === "site-csv" || kind === "site-pdf") {
      const id = Number(request.nextUrl.searchParams.get("id"));
      const raw = db.prepare(`SELECT ${SITE_SELECT} FROM sites WHERE id = ?`).get(id) as Record<string, unknown> | undefined;
      if (!raw) return NextResponse.json({ error: "Site nao encontrado." }, { status: 404 });
      const site = siteRow(raw);
      const siteSlug = sanitizeFilenameSegment(site.site, `site-${id}`);
      const lines = [["SITE", site.site], ["OPERADORA", site.operadoraOrigem], ["MUNICIPIO", `${site.municipio}/${site.uf}`], ["ENDERECO", site.endereco], ["TECNOLOGIA", site.tecnologia], ["STATUS", site.status], ["GOOGLE_MAPS", `https://maps.google.com/?q=${site.latitude},${site.longitude}`]];
      if (kind === "site-csv") {
        // sanitizeFilenameSegment() strips any traversal/separator characters from site.site
        // before it ever reaches the filesystem (audit-v4 risk R7); resolveExportPath() then
        // proves the final path still resolves inside EXPORTACOES as defense-in-depth.
        const siteFile = resolveExportPath(exportDir, `site-${siteSlug}-${stamp()}.csv`);
        await writeFile(siteFile, csvRows([["CAMPO", "VALOR"], ...lines]), { encoding: "utf8", flag: "wx" });
        return new NextResponse(Readable.toWeb(createReadStream(siteFile)) as ReadableStream, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${path.basename(siteFile)}"` } });
      }
      const pdf = simplePdf(`Site Intelligence - ${site.site}`, lines.map(([label, value]) => `${label}: ${value}`));
      return new NextResponse(pdf, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="site-${siteSlug}-${stamp()}.pdf"` } });
    }
    if (kind === "operator-intelligence" || kind === "tci-ranking") {
      const metrics = getOperatorMetrics(db, sql, values);
      const ordered = kind === "tci-ranking" ? metrics.sort((a,b) => b.tci - a.tci) : metrics.sort((a,b) => b.records - a.records);
      const report: unknown[][] = [["POSICAO", "OPERADORA_CLASSIFICADA", "REGISTROS", "SITES_UNICOS", "ESTADOS", "MUNICIPIOS", "TECNOLOGIAS", "POPULACAO_COBERTA", "ALTURA_MEDIA", "GEO_SCORE_MEDIO", "ORI_MEDIO", "TCI"]];
      ordered.forEach((item, index) => report.push([index + 1, item.operator, item.records, item.sites, item.states, item.municipalities, item.technologies, item.population, item.averageHeight, item.averageGeo, item.averageOri, item.tci]));
      const content = csvRows(report);
      await writeFile(filePath, content, { encoding: "utf8", flag: "wx" });
      const body = Readable.toWeb(createReadStream(filePath)) as ReadableStream;
      return new NextResponse(body, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}"`, "X-Export-Rows": String(report.length - 1), "X-Export-Path": path.basename(filePath) } });
    }
    if (kind === "executive") {
      const summary = db.prepare(`SELECT COUNT(*) total, COUNT(DISTINCT site_id) sites, COUNT(DISTINCT CASE WHEN geo_score >= 81 THEN site_id END) critical, COUNT(DISTINCT estado) states, COUNT(DISTINCT municipio) municipalities, COUNT(DISTINCT tecnologia) technologies, ROUND(AVG(CASE WHEN altura > 0 THEN altura END),1) average_height FROM sites ${sql}`).get(...values) as Record<string, unknown>;
      const grouped = (column: string, condition: string, limit: number) => db.prepare(`SELECT COALESCE(${column}, 'Não informado') label, COUNT(*) records, COUNT(DISTINCT site_id) sites FROM sites ${condition} GROUP BY ${column} ORDER BY sites DESC, records DESC LIMIT ${limit}`).all(...values) as Record<string, unknown>[];
      const criticalWhere = withClause(clauses, "geo_score >= 81");
      const critical = db.prepare(`SELECT site_id,municipio,estado,geo_score,risco FROM sites ${criticalWhere} ORDER BY geo_score DESC,populacao DESC LIMIT 100`).all(...values) as Record<string, unknown>[];
      const states = grouped("estado", criticalWhere, 10);
      const municipalities = grouped("municipio", criticalWhere, 10);
      const holders = grouped("detentor_infra", sql, 20);
      const report: unknown[][] = [["SECAO", "POSICAO", "INDICADOR", "LOCALIDADE", "UF", "VALOR", "DETALHE"]];
      const general = [["Total de registros", summary.total], ["Sites únicos", summary.sites], ["Sites críticos", summary.critical], ["Estados monitorados", summary.states], ["Municípios monitorados", summary.municipalities], ["Tecnologias mapeadas", summary.technologies], ["Altura média", `${summary.average_height} m`]];
      general.forEach(([label, value]) => report.push(["RESUMO GERAL", "", label, "", "", value, ""]));
      critical.forEach((item, index) => report.push(["RANKING CRÍTICO", index + 1, item.site_id, item.municipio, item.estado, item.geo_score, item.risco]));
      states.forEach((item, index) => report.push(["TOP ESTADOS CRÍTICOS", index + 1, item.label, "", item.label, item.sites, `${item.records} registros`]));
      municipalities.forEach((item, index) => report.push(["TOP MUNICÍPIOS CRÍTICOS", index + 1, item.label, item.label, "", item.sites, `${item.records} registros`]));
      holders.forEach((item, index) => report.push(["DETENTORES PRINCIPAIS", index + 1, item.label, "", "", item.sites, `${item.records} registros`]));
      const content = csvRows(report);
      await writeFile(filePath, content, { encoding: "utf8", flag: "wx" });
      console.info("csv_export_created", { kind, rows: report.length - 1, filename });
      const body = Readable.toWeb(createReadStream(filePath)) as ReadableStream;
      return new NextResponse(body, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}"`, "X-Export-Rows": String(report.length - 1), "X-Export-Path": path.basename(filePath) } });
    }
    const output = createWriteStream(filePath, { encoding: "utf8", flags: "wx" });
    const exportColumns = kind === "ori-ranking" ? ["SITE_ID", "STATION_ID", "OPERADORA_CLASSIFICADA", "MUNICIPIO", "UF", "TECNOLOGIA", "STATUS", "ALTURA", "TIPO_DE_INFRA", "GEO_SCORE", "ORI", "RISCO_ORI"] : columns;
    output.write(`\uFEFF${exportColumns.join(";")}\r\n`);
    const query = kind === "ori-ranking"
      ? `SELECT site_id,station_id,operadora_classificada,municipio,estado,tecnologia,status_normalizado,altura,tipo_infra,geo_score,ori_score,ori_risk FROM sites ${sql} ORDER BY ori_score DESC,geo_score DESC,site_id`
      : `SELECT site_id,municipio,estado,tecnologia,status_normalizado,detentor_infra,tipo_infra,altura,latitude,longitude,geo_score,risco FROM sites ${where} ORDER BY geo_score DESC, altura DESC, site_id`;
    const statement = db.prepare(query);
    let rows = 0;
    for (const raw of statement.iterate(...values) as Iterable<Record<string, unknown>>) {
      const valuesForRow = kind === "ori-ranking"
        ? [raw.site_id, raw.station_id, raw.operadora_classificada, raw.municipio, raw.estado, raw.tecnologia, raw.status_normalizado, raw.altura, raw.tipo_infra, raw.geo_score, raw.ori_score, raw.ori_risk]
        : [raw.site_id, raw.municipio, raw.estado, raw.tecnologia, raw.status_normalizado, raw.detentor_infra, raw.tipo_infra, raw.altura, raw.latitude, raw.longitude, raw.geo_score, raw.risco];
      const line = valuesForRow.map(csv).join(";") + "\r\n";
      rows += 1;
      if (!output.write(line)) await once(output, "drain");
    }
    output.end();
    await once(output, "finish");
    console.info("csv_export_created", { kind, rows, filename });
    const body = Readable.toWeb(createReadStream(filePath)) as ReadableStream;
    return new NextResponse(body, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}"`, "X-Export-Rows": String(rows), "X-Export-Path": path.basename(filePath) } });
  } catch (error) {
    console.error("csv_export_failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Não foi possível gerar o CSV local." }, { status: 500 });
  }
}
