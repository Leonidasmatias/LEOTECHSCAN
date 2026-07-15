import type { DatabaseSync } from "node:sqlite";
import { SITE_SELECT } from "@/api/site-query";
import { text } from "@/lib/db";
import { siteRow } from "@/services/site-service";
import { alertRows } from "@/services/alert-engine";
import { marketSnapshot } from "@/services/market-engine";
import { rolloutRows } from "@/services/rollout-engine";
import { getStrategicMunicipalities } from "@/services/strategic-data";
import { sentinelRules, calculateLts, calculateOpi, calculateSri, calculateTci, type MunicipalityMetrics } from "@/services/sentinel-scoring";
import { getSiteNotes } from "@/services/site-notes";

type PlanInput = {
  operadora?: string;
  uf?: string;
  municipio?: string;
  tecnologia?: string;
  metaNovosSites?: number;
  horizonteDias?: number;
};

function metric(row: Record<string, unknown>): MunicipalityMetrics {
  return {
    municipio: text(row.municipio),
    uf: text(row.uf),
    records: Number(row.records || 0),
    sites: Number(row.sites || 0),
    operators: Number(row.operators || 0),
    technologies: Number(row.technologies || 0),
    population: Number(row.population || 0),
    avgGeo: Number(row.avg_geo || 0),
  };
}

function maxima(db: DatabaseSync): MunicipalityMetrics {
  return metric(db.prepare("SELECT 'MAX' municipio,'BR' uf,MAX(records) records,MAX(sites) sites,MAX(operators) operators,MAX(technologies) technologies,MAX(population) population,MAX(avg_geo) avg_geo FROM (SELECT municipio,uf,COUNT(*) records,COUNT(DISTINCT site) sites,COUNT(DISTINCT operadora_origem) operators,COUNT(DISTINCT tecnologia) technologies,MAX(populacao) population,ROUND(AVG(geo_score),1) avg_geo FROM sites GROUP BY uf,municipio)").get() as Record<string, unknown>);
}

function distanceKm(aLat: number, aLon: number, bLat: number, bLon: number) {
  const rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad;
  const dLon = (bLon - aLon) * rad;
  const lat1 = aLat * rad;
  const lat2 = bLat * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function rules() {
  return sentinelRules.enterpriseV3;
}

export function digitalTwinSite(db: DatabaseSync, siteId: number) {
  const raw = db.prepare(`SELECT ${SITE_SELECT} FROM sites WHERE id = ?`).get(siteId) as Record<string, unknown> | undefined;
  if (!raw) return null;
  const site = siteRow(raw);
  const municipality = metric(db.prepare("SELECT municipio,uf,COUNT(*) records,COUNT(DISTINCT site) sites,COUNT(DISTINCT operadora_origem) operators,COUNT(DISTINCT tecnologia) technologies,MAX(populacao) population,ROUND(AVG(geo_score),1) avg_geo FROM sites WHERE municipio = ? AND uf = ? GROUP BY municipio,uf").get(site.municipio, site.uf) as Record<string, unknown>);
  const max = maxima(db);
  const lts = calculateLts(municipality, max);
  const tci = calculateTci(municipality, max);
  const opi = calculateOpi(municipality, max);
  const sri = calculateSri(municipality, max);
  const radius = sentinelRules.nearby.radiusKm;
  const box = radius / 111;
  const nearby = (db.prepare(`SELECT ${SITE_SELECT} FROM sites WHERE id <> ? AND latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ? LIMIT 1200`).all(site.id, site.latitude - box, site.latitude + box, site.longitude - box, site.longitude + box) as Record<string, unknown>[])
    .map(siteRow)
    .map((item) => ({ ...item, distanceKm: Number(distanceKm(site.latitude, site.longitude, item.latitude, item.longitude).toFixed(2)) }))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, rules().digitalTwin.nearbySiteLimit);
  const neighborMunicipalities = getStrategicMunicipalities(db)
    .filter((item) => item.uf === site.uf && item.municipio !== site.municipio)
    .sort((a, b) => b.opi - a.opi)
    .slice(0, rules().digitalTwin.nearbyMunicipalityLimit);
  const notes = getSiteNotes(db, site.id);
  const alerts = alertRows(db).filter((item) => JSON.stringify(item).includes(site.municipio)).slice(0, 8);
  const opportunity = opi >= rules().digitalTwin.opportunityHigh ? "Alta" : opi >= 50 ? "Media" : "Baixa";
  const risk = sri.score >= rules().digitalTwin.riskCritical ? "Critico" : sri.level;
  return {
    site,
    scores: { lts, ori: site.oriScore, tci, opi, sri },
    alerts,
    notes,
    timeline: [
      { type: "importacao", date: site.dataImportacao, detail: site.arquivoOrigem },
      { type: "status", date: site.dataImportacao, detail: site.status },
      { type: "projeto", date: site.dataImportacao, detail: site.projeto },
    ],
    nearbySites: nearby,
    nearbyMunicipalities: neighborMunicipalities,
    risk,
    opportunity,
    strategicRecommendation: `Recomendacao baseada nos dados disponiveis: priorizar ${site.municipio}/${site.uf} para ${opportunity === "Alta" ? "expansao e mitigacao de risco" : "monitoramento e manutencao de qualidade"}, considerando OPI ${opi}, SRI ${sri.score} e LTS ${lts.score}.`,
  };
}

export function strategicPlanning(db: DatabaseSync, input: PlanInput) {
  const meta = Math.max(1, Number(input.metaNovosSites || 50));
  const horizonte = Math.max(30, Number(input.horizonteDias || 120));
  const cost = rules().strategicPlanning.defaultCostPerSite;
  const municipalities = getStrategicMunicipalities(db)
    .filter((item) => !input.uf || item.uf === input.uf)
    .filter((item) => !input.municipio || item.municipio.toUpperCase().includes(String(input.municipio).toUpperCase()))
    .sort((a, b) => b.opi - a.opi || a.lts.score - b.lts.score)
    .slice(0, 25);
  const weightTotal = municipalities.reduce((sum, item) => sum + Math.max(1, item.opi), 0) || 1;
  const distribution = municipalities.map((item) => {
    const novosSites = Math.max(1, Math.round((Math.max(1, item.opi) / weightTotal) * meta));
    return {
      municipio: item.municipio,
      uf: item.uf,
      ltsAtual: item.lts.score,
      opiAtual: item.opi,
      sriAtual: item.sri.score,
      sitesAtuais: item.sites,
      novosSites,
      tecnologiaAlvo: input.tecnologia || "5G",
      impactoLts: Math.min(100, Math.round(item.lts.score + novosSites * rules().strategicPlanning.impactWeights.lts * 10)),
      impactoOpi: Math.max(0, Math.round(item.opi - novosSites * rules().strategicPlanning.impactWeights.opi * 10)),
    };
  });
  const teams = Math.max(1, Math.ceil(meta / rules().strategicPlanning.sitesPerTeamPerMonth / Math.max(horizonte / 30, 1)));
  const mos = Math.ceil(meta * rules().strategicPlanning.mosPerSite);
  const installations = Math.ceil(meta * rules().strategicPlanning.installationsPerSite);
  const avgRisk = distribution.length ? Math.round(distribution.reduce((sum, item) => sum + item.sriAtual, 0) / distribution.length) : 0;
  return {
    input: { operadora: input.operadora || "Todas", uf: input.uf || "BR", municipio: input.municipio || "", tecnologia: input.tecnologia || "5G", metaNovosSites: meta, horizonteDias: horizonte },
    priorityMunicipalities: municipalities.slice(0, 10),
    distribution,
    estimates: {
      teams,
      mos,
      installations,
      deadlineDays: horizonte,
      estimatedCost: meta * cost,
      operationalRisk: avgRisk >= rules().strategicPlanning.riskLimits.high ? "Alto" : avgRisk >= rules().strategicPlanning.riskLimits.medium ? "Medio" : "Baixo",
    },
    finalRecommendation: `Estimativa baseada nos dados disponiveis: implantar ${meta} sites em ${distribution.length} municipios priorizados, com ${teams} equipes, custo estimado de R$ ${(meta * cost).toLocaleString("pt-BR")} e foco em ${input.tecnologia || "5G"}.`,
  };
}

export function scenarioPlanner(db: DatabaseSync, input: PlanInput) {
  const plan = strategicPlanning(db, input);
  const market = marketSnapshot(db);
  const operator = String(input.operadora || "VIVO").toUpperCase();
  const beforeOperator = market.operators.find((item) => String(item.operator).toUpperCase() === operator);
  const totalRecords = market.operators.reduce((sum, item) => sum + Number(item.records || 0), 0);
  const added = plan.input.metaNovosSites;
  const beforeShare = totalRecords ? Number(((Number(beforeOperator?.records || 0) / totalRecords) * 100).toFixed(2)) : 0;
  const afterShare = totalRecords ? Number((((Number(beforeOperator?.records || 0) + added) / (totalRecords + added)) * 100).toFixed(2)) : 0;
  return {
    input: plan.input,
    before: { marketShare: beforeShare, operatorRecords: Number(beforeOperator?.records || 0), totalRecords },
    after: { marketShare: afterShare, operatorRecords: Number(beforeOperator?.records || 0) + added, totalRecords: totalRecords + added },
    impacts: {
      lts: Number((plan.distribution.reduce((sum, item) => sum + (item.impactoLts - item.ltsAtual), 0) / Math.max(plan.distribution.length, 1)).toFixed(1)),
      tci: Number((added * 0.08).toFixed(1)),
      opi: Number((plan.distribution.reduce((sum, item) => sum + (item.opiAtual - item.impactoOpi), 0) / Math.max(plan.distribution.length, 1)).toFixed(1)),
      marketShare: Number((afterShare - beforeShare).toFixed(2)),
    },
    benefitedMunicipalities: plan.distribution.slice(0, rules().scenarioPlanner.maxBenefitedMunicipalities),
    rankingChanged: plan.distribution.slice(0, 10).map((item, index) => ({ rank: index + 1, municipio: item.municipio, uf: item.uf, novoLtsEstimado: item.impactoLts })),
    risks: [`Simulacao estimativa baseada nos dados disponiveis.`, `Validar disponibilidade de equipes, licenciamento e capacidade de transmissao antes da execucao.`],
  };
}

export function geointelligence(db: DatabaseSync, siteId: number, radiusKm: number) {
  const twin = digitalTwinSite(db, siteId);
  if (!twin) return null;
  const radius = Math.min(Math.max(1, radiusKm || rules().advancedGis.defaultRadiusKm), rules().advancedGis.maxRadiusKm);
  const box = radius / 111;
  const site = twin.site;
  const sites = (db.prepare(`SELECT ${SITE_SELECT} FROM sites WHERE latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ? LIMIT ?`).all(site.latitude - box, site.latitude + box, site.longitude - box, site.longitude + box, rules().advancedGis.maxSites) as Record<string, unknown>[])
    .map(siteRow)
    .map((item) => ({ ...item, distanceKm: Number(distanceKm(site.latitude, site.longitude, item.latitude, item.longitude).toFixed(2)) }))
    .filter((item) => item.distanceKm <= radius)
    .sort((a, b) => a.distanceKm - b.distanceKm);
  const countBy = (key: "operadoraOrigem" | "tecnologia" | "risco") => Object.values(sites.reduce((acc, item) => {
    const label = String(item[key] || "Nao informado");
    acc[label] = acc[label] || { label, total: 0 };
    acc[label].total += 1;
    return acc;
  }, {} as Record<string, { label: string; total: number }>));
  return {
    center: site,
    radiusKm: radius,
    sitesWithinRadius: sites,
    nearbyMunicipalities: twin.nearbyMunicipalities,
    clusters: { byOperator: countBy("operadoraOrigem"), byTechnology: countBy("tecnologia"), byRisk: countBy("risco") },
    layers: {
      technology: countBy("tecnologia"),
      lts: twin.nearbyMunicipalities.map((item) => ({ municipio: item.municipio, uf: item.uf, lts: item.lts.score })),
      opi: twin.nearbyMunicipalities.map((item) => ({ municipio: item.municipio, uf: item.uf, opi: item.opi })),
      sri: twin.nearbyMunicipalities.map((item) => ({ municipio: item.municipio, uf: item.uf, sri: item.sri.score })),
      alerts: twin.alerts,
      opportunities: twin.nearbyMunicipalities.filter((item) => item.opi >= rules().digitalTwin.opportunityHigh),
    },
  };
}

export function executiveWorkspace(db: DatabaseSync) {
  const market = marketSnapshot(db);
  const opportunities = rolloutRows(db).slice(0, 10);
  const alerts = alertRows(db).slice(0, 10);
  const timeline = db.prepare("SELECT operadora,arquivo_origem,linhas_importadas,importado_em,excel_inalterado FROM import_audit ORDER BY id DESC LIMIT 10").all();
  const summary = db.prepare("SELECT COUNT(*) records,COUNT(DISTINCT site) sites,COUNT(DISTINCT municipio) municipalities,COUNT(DISTINCT uf) states,MAX(data_importacao) lastImport FROM sites").get() as Record<string, unknown>;
  return {
    kpis: summary,
    strategicRecommendations: [
      "Priorizar municipios com OPI alto e LTS baixo para expansao orientada por impacto.",
      "Tratar alertas criticos antes de ampliar cobertura em areas de risco operacional.",
      "Usar simulacoes como estimativa baseada nos dados disponiveis, nao como ordem automatica de execucao.",
    ],
    criticalAlerts: alerts,
    topOpportunities: opportunities,
    marketComparison: market.comparisons,
    potentialExpansionImpact: opportunities.reduce((sum, item) => sum + Number(item.novosSitesEstimados || 0), 0),
    executiveMap: opportunities.map((item) => ({ municipio: item.municipio, uf: item.uf, opi: item.opportunityIndex, priority: item.prioridade })),
    timeline,
  };
}

export function executiveReportRows(db: DatabaseSync, type: string) {
  if (type === "comparativo-tim-vivo") {
    const market = marketSnapshot(db);
    return [["OPERADORA", "REGISTROS", "SITES", "UFS", "MUNICIPIOS"], ...market.operators.map((item) => [item.operator, item.records, item.sites, item.states, item.municipalities])];
  }
  if (type === "oportunidades-expansao" || type === "ranking-municipios") {
    return [["MUNICIPIO", "UF", "OPI", "LTS", "TCI", "NOVOS_SITES", "PRIORIDADE"], ...rolloutRows(db).slice(0, rules().executiveReports.opportunityLimit).map((item) => [item.municipio, item.uf, item.opportunityIndex, item.lts, item.tci, item.novosSitesEstimados, item.prioridade])];
  }
  if (type === "alertas-criticos") {
    return [["CRITICIDADE", "CATEGORIA", "ORIGEM", "DESCRICAO"], ...alertRows(db).slice(0, rules().executiveReports.criticalAlertLimit).map((item) => [item.criticidade, item.categoria, item.origem, item.descricao])];
  }
  const workspace = executiveWorkspace(db);
  return [["INDICADOR", "VALOR"], ...Object.entries(workspace.kpis).map(([key, value]) => [key, value]), ["impacto_potencial_expansao", workspace.potentialExpansionImpact]];
}
