import { NextRequest, NextResponse } from "next/server";
import { SITE_SELECT } from "@/api/site-query";
import { getDb, text } from "@/lib/db";
import { FILTER_COLUMNS, whereFrom, withClause } from "@/lib/filters";
import { getOperatorMetrics } from "@/lib/operator";
import { siteRow } from "@/services/site-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CacheEntry = { expiresAt: number; payload: unknown };
const dashboardCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000;

export async function GET(request: NextRequest) {
  try {
    const cacheKey = request.nextUrl.searchParams.toString() || "default";
    const cached = dashboardCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return NextResponse.json(cached.payload, { headers: { "X-Sentinel-Cache": "HIT" } });
    }
    const db = getDb();
    const { clauses, sql, values } = whereFrom(request.nextUrl.searchParams);
    const page = Math.max(1, Number(request.nextUrl.searchParams.get("page") || 1));
    const pageSize = 30;
    const count = db.prepare(`SELECT COUNT(*) total, COUNT(DISTINCT site_id) unique_sites, ROUND(AVG(geo_score),1) avg_score, SUM(CASE WHEN geo_score >= 81 THEN 1 ELSE 0 END) critical, COUNT(DISTINCT CASE WHEN geo_score >= 81 THEN site_id END) critical_sites, COUNT(DISTINCT estado) tracked_states, COUNT(DISTINCT municipio) tracked_municipalities, COUNT(DISTINCT tecnologia) technologies, ROUND(AVG(CASE WHEN altura > 0 THEN altura END),1) average_height FROM sites ${sql}`).get(...values) as Record<string, unknown>;
    const group = (column: string, limit = 12) => (db.prepare(`SELECT COALESCE(${column}, 'Não informado') label, COUNT(*) value FROM sites ${sql} GROUP BY ${column} ORDER BY value DESC LIMIT ${limit}`).all(...values) as Record<string, unknown>[]).map(x => ({ label: text(x.label), value: Number(x.value) }));
    const volume = (column: string, limit = 20) => (db.prepare(`SELECT COALESCE(${column}, 'Não informado') label, COUNT(*) records, COUNT(DISTINCT site_id) sites FROM sites ${sql} GROUP BY ${column} ORDER BY records DESC LIMIT ${limit}`).all(...values) as Record<string, unknown>[]).map(x => ({ label: text(x.label), records: Number(x.records), sites: Number(x.sites) }));
    const average = (column: string, limit = 20) => (db.prepare(`SELECT COALESCE(${column}, 'Não informado') label, ROUND(AVG(altura),1) average, COUNT(*) samples FROM sites ${withClause(clauses, "altura > 0")} GROUP BY ${column} ORDER BY average DESC LIMIT ${limit}`).all(...values) as Record<string, unknown>[]).map(x => ({ label: text(x.label), average: Number(x.average), samples: Number(x.samples) }));
    const criticalVolume = (column: string, limit = 10) => (db.prepare(`SELECT COALESCE(${column}, 'Não informado') label, COUNT(*) records, COUNT(DISTINCT site_id) sites FROM sites ${withClause(clauses, "geo_score >= 81")} GROUP BY ${column} ORDER BY sites DESC, records DESC LIMIT ${limit}`).all(...values) as Record<string, unknown>[]).map(x => ({ label: text(x.label), records: Number(x.records), sites: Number(x.sites) }));
    const risk = db.prepare(`SELECT SUM(CASE WHEN max_score <= 30 THEN 1 ELSE 0 END) low, SUM(CASE WHEN max_score BETWEEN 31 AND 60 THEN 1 ELSE 0 END) medium, SUM(CASE WHEN max_score BETWEEN 61 AND 80 THEN 1 ELSE 0 END) high, SUM(CASE WHEN max_score >= 81 THEN 1 ELSE 0 END) critical FROM (SELECT site_id, MAX(geo_score) max_score FROM sites ${sql} GROUP BY site_id)`).get(...values) as Record<string, unknown>;
    const pointWhere = sql
      ? `${sql} AND latitude BETWEEN -34 AND 6 AND longitude BETWEEN -75 AND -32`
      : "WHERE latitude BETWEEN -34 AND 6 AND longitude BETWEEN -75 AND -32";
    const points = (db.prepare(`SELECT ${SITE_SELECT} FROM sites ${pointWhere} ORDER BY (id * 1103515245 + 12345) % 2147483647 LIMIT 4000`).all(...values) as Record<string, unknown>[]).map(siteRow);
    const ranking = (db.prepare(`SELECT ${SITE_SELECT} FROM sites ${sql} ORDER BY geo_score DESC, populacao DESC LIMIT 8`).all(...values) as Record<string, unknown>[]).map(siteRow);
    const tallest = (db.prepare(`SELECT ${SITE_SELECT} FROM sites ${withClause(clauses, "altura > 0")} ORDER BY altura DESC, geo_score DESC LIMIT 20`).all(...values) as Record<string, unknown>[]).map(siteRow);
    const table = (db.prepare(`SELECT ${SITE_SELECT} FROM sites ${sql} ORDER BY geo_score DESC, id LIMIT ? OFFSET ?`).all(...values, pageSize, (page - 1) * pageSize) as Record<string, unknown>[]).map(siteRow);
    const options: Record<string, string[]> = {};
    for (const [key, column] of Object.entries(FILTER_COLUMNS)) {
      options[key] = (db.prepare(`SELECT DISTINCT ${column} value FROM sites WHERE ${column} IS NOT NULL AND TRIM(${column}) <> '' ORDER BY ${column}`).all() as Record<string, unknown>[]).map(x => text(x.value));
    }
    const metaRows = db.prepare("SELECT key,value FROM metadata").all() as { key: string; value: string }[];
    const meta = Object.fromEntries(metaRows.map(x => [x.key, x.value]));
    const total = Number(count.total || 0);
    const operatorMetrics = getOperatorMetrics(db, sql, values);
    const operatorOrder = ["TIM", "Vivo", "Claro", "Oi", "Algar", "Outros", "Não Identificado"];
    const cards = operatorOrder.map(operator => { const metric = operatorMetrics.find(item => item.operator === operator); return { operator, records: metric?.records || 0, sites: metric?.sites || 0 }; });
    const payload = {
      summary: { total, uniqueSites: Number(count.unique_sites || 0), averageScore: Number(count.avg_score || 0), critical: Number(count.critical || 0), criticalSites: Number(count.critical_sites || 0), trackedStates: Number(count.tracked_states || 0), trackedMunicipalities: Number(count.tracked_municipalities || 0), technologies: Number(count.technologies || 0), averageHeight: Number(count.average_height || 0) },
      breakdowns: { tecnologia: group("tecnologia", 20), uf: group("estado", 20), status: group("status_normalizado", 20), detentor: group("detentor_infra", 20), infra: group("tipo_infra", 20) },
      risk: { low: Number(risk.low || 0), medium: Number(risk.medium || 0), high: Number(risk.high || 0), critical: Number(risk.critical || 0), criticalPercent: Number(count.unique_sites) ? Number(((Number(risk.critical || 0) / Number(count.unique_sites)) * 100).toFixed(1)) : 0, states: criticalVolume("estado"), municipalities: criticalVolume("municipio") },
      operators: { cards, metrics: operatorMetrics.sort((a,b) => b.records - a.records), oriRanking: [...operatorMetrics].sort((a,b) => b.averageOri - a.averageOri), tciRanking: [...operatorMetrics].sort((a,b) => b.tci - a.tci) },
      intelligence: { municipalities: volume("municipio"), states: volume("estado"), tallest, averageHeightByState: average("estado"), averageHeightByHolder: average("detentor_infra") },
      options, points, ranking, table,
      pagination: { page, pageSize, total, pages: Math.max(1, Math.ceil(total / pageSize)) },
      meta: { importedAt: meta.imported_at || "", sourceName: meta.source_name || "Base Excel", sampled: total > 4000, fallbackUsed: meta.fallback_used === "True" },
    };
    dashboardCache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, payload });
    const oldestKey = dashboardCache.keys().next().value;
    if (dashboardCache.size > 40 && oldestKey) dashboardCache.delete(oldestKey);
    return NextResponse.json(payload, { headers: { "X-Sentinel-Cache": "MISS" } });
  } catch (error) {
    console.error("dashboard_read_failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Base derivada indisponível. Execute o importador conforme o README." }, { status: 503 });
  }
}
