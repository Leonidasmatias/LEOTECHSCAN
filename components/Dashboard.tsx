"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import Donut from "./Donut";
import { AverageRanking, TallestStructures, VolumeRanking } from "./AnalyticsPanels";
import MissionControl from "./MissionControl";
import OperatorView from "./OperatorView";
import { AlertCenterView, MarketView, OpportunitiesView, RolloutView, TelecomAIView } from "./Sprint2BModules";
import { DataQualityView, DuplicatesView, NationalTimelineView } from "./Sprint3Modules";
import { AdvancedGisView, DigitalTwinView, ExecutiveReportsView, ExecutiveWorkspaceView, ScenarioPlannerView, StrategicPlanningView } from "./Sprint4Modules";
import { CopernicusSiteEvidence, SatelliteIntelligenceView } from "./CopernicusModules";
import { DataTrustView, EvidenceCenterPanel, SiteTrustPanel } from "./DataTrustModules";
import { SentinelCoreView } from "./SentinelCoreModules";
import { CapabilityBadge, CapabilityNote } from "@/components/CapabilityBadge";
import type { DashboardData, SiteIntelligenceData, SiteRow } from "@/lib/types";

const MapView = dynamic(() => import("./MapView"), { ssr: false, loading: () => <div className="map-loading">Carregando camada geografica...</div> });
const nf = new Intl.NumberFormat("pt-BR");
const filterDefs = [["estado", "Estado"], ["municipio", "Municipio"], ["tecnologia", "Tecnologia"], ["status", "Status"], ["detentor", "Detentor Infra"], ["tipoInfra", "Tipo de Infra"], ["operadora", "Operadora"]] as const;

function slug(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function SectionTitle({ index, eyebrow, title, description, actions }: { index: string; eyebrow: string; title: string; description: string; actions?: React.ReactNode }) {
  return <div className="section-title"><span>{index}</span><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2><small>{description}</small></div>{actions && <div className="section-actions">{actions}</div>}</div>;
}

function mapsLink(site: SiteRow) {
  return `https://maps.google.com/?q=${site.latitude},${site.longitude}`;
}

function whatsappSummary(site: SiteRow) {
  return `SITE: ${site.site}
Operadora: ${site.operadoraOrigem}
Municipio: ${site.municipio}/${site.uf}
Endereco: ${site.endereco}
Tecnologia: ${site.tecnologia}
Coordenadas: ${site.latitude}, ${site.longitude}
Google Maps: ${mapsLink(site)}
Status: ${site.status}`;
}

function SiteIntelligencePanel({ site, onClose }: { site: SiteRow; onClose: () => void }) {
  const [copied, setCopied] = useState("");
  const [intel, setIntel] = useState<SiteIntelligenceData>();
  const [recommendation, setRecommendation] = useState<{ recommendations: string[]; operationalScore: number; expansionPotential: string; priority: string }>();
  const [notes, setNotes] = useState<Array<{ id: number; note: string; createdAt: string }>>([]);
  const [noteText, setNoteText] = useState("");
  const [showNearby, setShowNearby] = useState(false);
  const [showTimeline, setShowTimeline] = useState(true);

  useEffect(() => {
    let active = true;
    setIntel(undefined);
    fetch(`/api/sites/${site.id}/intelligence`).then(async (response) => {
      const body = await response.json();
      if (response.ok && active) setIntel(body);
    }).catch(() => undefined);
    fetch(`/api/site-recommendation?id=${site.id}`).then(async (response) => {
      const body = await response.json();
      if (response.ok && active) setRecommendation(body);
    }).catch(() => undefined);
    fetch(`/api/sites/${site.id}/notes`).then(async (response) => {
      const body = await response.json();
      if (response.ok && active) setNotes(body.notes || []);
    }).catch(() => undefined);
    return () => { active = false; };
  }, [site.id]);

  const saveNote = async () => {
    const value = noteText.trim();
    if (!value) return;
    const response = await fetch(`/api/sites/${site.id}/notes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ note: value }) });
    const body = await response.json();
    if (response.ok) {
      setNotes((current) => [body.note, ...current]);
      setNoteText("");
    }
  };

  const copy = async (label: string, value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(label);
    window.setTimeout(() => setCopied(""), 1500);
  };

  const link = mapsLink(site);
  return <div className="site-panel-backdrop" role="dialog" aria-modal="true"><aside className="site-panel panel">
    <div className="site-panel-head"><div><p className="eyebrow">SITE INTELLIGENCE</p><h2>{site.site}</h2><span>{site.operadoraOrigem} · {site.municipio}/{site.uf}</span></div><button type="button" onClick={onClose}>Fechar</button></div>
    <div className="site-panel-grid"><span>Operadora<strong>{site.operadoraOrigem}</strong></span><span>Municipio/UF<strong>{site.municipio}/{site.uf}</strong></span><span>Regional<strong>{site.regional}</strong></span><span>Status<strong>{site.status}</strong></span><span>Tecnologia<strong>{site.tecnologia}</strong></span><span>Projeto<strong>{site.projeto}</strong></span><span>Tipo site<strong>{site.tipoSite}</strong></span><span>Arquivo<strong>{site.arquivoOrigem}</strong></span></div>
    <div className="site-score-grid"><span>LTS<strong>{intel?.scores.lts.score ?? "-"} {intel?.scores.lts.starsText ?? ""}</strong><small>{intel?.scores.lts.level ?? "carregando"}</small></span><span>ORI<strong>{intel?.scores.ori ?? site.oriScore}</strong><small>Operator Ranking</small></span><span>TCI<strong>{intel?.scores.tci ?? "-"}</strong><small>Cobertura territorial</small></span><span>OPI<strong>{intel?.scores.opi ?? "-"}</strong><small>Potencial</small></span><span>SRI<strong>{intel?.scores.sri.score ?? "-"}</strong><small>{intel?.scores.sri.level ?? "risco"}</small></span><span>Operacional<strong>{recommendation?.operationalScore ?? "-"}</strong><small>{recommendation?.priority ?? "prioridade"}</small></span></div>
    <section className="site-timeline"><h3>Recomendacoes Telecom AI</h3>{(recommendation?.recommendations || []).map((item) => <div key={item}><b>{item}</b><span>Potencial: {recommendation?.expansionPotential || "-"}</span></div>)}</section>
    <div className="site-address"><small>Endereco</small><strong>{site.endereco}</strong></div>
    <div className="site-coordinates"><span>{site.latitude}</span><span>{site.longitude}</span><a href={link} target="_blank" rel="noreferrer">Abrir Google Maps</a></div>
    <div className="site-actions"><button type="button" onClick={() => copy("endereco", site.endereco)}>Copiar endereco</button><button type="button" onClick={() => copy("coordenadas", `${site.latitude}, ${site.longitude}`)}>Copiar coordenadas</button><button type="button" onClick={() => copy("Google Maps", link)}>Copiar Google Maps</button><button type="button" onClick={() => copy("WhatsApp", whatsappSummary(site))}>Copiar WhatsApp</button><a href={`/api/export?type=site-csv&id=${site.id}`}>Exportar CSV</a><a href={`/api/export?type=site-pdf&id=${site.id}`}>Exportar PDF</a><button type="button" onClick={() => setShowNearby((value) => !value)}>Mostrar Sites Proximos</button><button type="button" onClick={() => setShowTimeline((value) => !value)}>Abrir Historico</button></div>
    <CopernicusSiteEvidence siteId={site.id} />
    <SiteTrustPanel siteId={site.id} />
    <EvidenceCenterPanel siteId={site.id} />
    <section className="site-notes"><h3>Observacoes operacionais</h3><div><textarea value={noteText} onChange={(event) => setNoteText(event.target.value)} placeholder="Registrar observacao local do site..." /><button type="button" onClick={saveNote}>Salvar observacao</button></div>{notes.map((item) => <p key={item.id}><strong>{item.createdAt}</strong>{item.note}</p>)}</section>
    {showTimeline ? <section className="site-timeline"><h3>Timeline do site</h3>{(intel?.timeline || []).map((item) => <div key={`${item.type}-${item.label}`}><b>{item.label}</b><span>{item.date || "sem data"} · {item.detail}</span></div>)}</section> : null}
    {showNearby ? <section className="nearby-sites"><h3>10 sites mais proximos</h3>{(intel?.nearby || []).map((item) => <button type="button" key={item.id} onClick={() => window.location.assign(`/?q=${encodeURIComponent(item.site)}`)}><strong>{item.site}</strong><span>{item.operadoraOrigem} · {item.distanceKm} km · {item.municipio}</span></button>)}</section> : null}
    {copied ? <p className="copy-status">Copiado: {copied}</p> : null}
  </aside></div>;
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [activeView, setActiveView] = useState<"mission" | "executive" | "operators" | "ai" | "rollout" | "alerts" | "market" | "opportunities" | "quality" | "duplicates" | "timeline" | "digitalTwin" | "strategicPlanning" | "scenarioPlanner" | "advancedGis" | "executiveReports" | "executiveWorkspace" | "satellite" | "dataTrust" | "sentinelCore">("mission");
  const [selectedSite, setSelectedSite] = useState<SiteRow | null>(null);
  const requestParams = useMemo(() => { const params = new URLSearchParams({ ...filters, page: String(page) }); if (query) params.set("q", query); return params; }, [filters, query, page]);
  const load = useCallback(async () => { setLoading(true); setError(""); try { const response = await fetch(`/api/dashboard?${requestParams}`); const body = await response.json(); if (!response.ok) throw new Error(body.error); setData(body); } catch (e) { setError(e instanceof Error ? e.message : "Falha ao ler a base"); } finally { setLoading(false); } }, [requestParams]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (query.trim() && data?.table?.length) setSelectedSite(data.table[0]); }, [data?.table, query]);
  const active = useMemo(() => Object.values(filters).filter(Boolean).length + (query ? 1 : 0), [filters, query]);
  const setFilter = (key: string, value: string) => { setPage(1); setFilters((old) => ({ ...old, [key]: value })); };
  const clear = () => { setFilters({}); setQuery(""); setPage(1); };
  const exportUrl = (type: "ranking" | "critical" | "executive" | "operator-intelligence" | "ori-ranking" | "tci-ranking") => { const params = new URLSearchParams(requestParams); params.delete("page"); params.set("type", type); return `/api/export?${params}`; };

  return <main>
    <header className="topbar"><div className="brand"><div className="brand-mark">L<span>T</span></div><div><strong>Leonidas Tech</strong><small>Sentinel-1 Enterprise</small></div></div><div className="topbar-center">Telecom Intelligence Center</div><div className="status-pill"><i /> SQLite Online · Local Build</div></header>
    <div className="shell">
      <section className="hero executive-hero"><div><p className="eyebrow">LEONIDAS TECH - SENTINEL-1</p><h1>Mission<br /><em>Control.</em></h1><p className="hero-subtitle">Telecom Infrastructure Intelligence</p><p>Plataforma executiva local para cobertura, risco, oportunidade e inteligencia multioperadora.</p><div className="version-chip">V2 · SPRINT 2A · LOCAL</div></div><div className="hero-orbit"><span>LTS</span><strong>V2</strong><small>SENTINEL</small></div></section>
      <section className="filters panel"><div className="search"><span>⌕</span><input value={query} onChange={(event) => { setPage(1); setQuery(event.target.value); }} placeholder="Buscar site, municipio, UF, operadora ou endereco..." /></div>{filterDefs.map(([key, label]) => <label key={key}><span>{label}</span><select value={filters[key] || ""} onChange={(event) => setFilter(key, event.target.value)}><option value="">Todos</option>{(data?.options[key] || []).map((value) => <option key={value}>{value}</option>)}</select></label>)}<button onClick={clear} disabled={!active}>Limpar {active ? `(${active})` : ""}</button></section>
      {error && <section className="error">{error}</section>}
      <nav className="view-tabs panel" aria-label="Visoes do LeoTechScan"><button className={activeView === "mission" ? "active" : ""} onClick={() => setActiveView("mission")}><span>01</span>Mission Control<small>Centro de comando V2</small></button><button className={activeView === "executive" ? "active" : ""} onClick={() => setActiveView("executive")}><span>02</span>Dashboard Executivo<small>Executive Risk</small></button><button className={activeView === "operators" ? "active" : ""} onClick={() => setActiveView("operators")}><span>03</span>Operator Intelligence<small>Operadoras</small></button><button className={activeView === "ai" ? "active" : ""} onClick={() => setActiveView("ai")}><span>04</span>Telecom AI<small>Consultas locais</small></button><button className={activeView === "rollout" ? "active" : ""} onClick={() => setActiveView("rollout")}><span>05</span>Rollout<small>Planejamento</small></button><button className={activeView === "alerts" ? "active" : ""} onClick={() => setActiveView("alerts")}><span>06</span>Alert Center<small>Riscos</small></button><button className={activeView === "market" ? "active" : ""} onClick={() => setActiveView("market")}><span>07</span>Market<small>Mercado</small></button><button className={activeView === "opportunities" ? "active" : ""} onClick={() => setActiveView("opportunities")}><span>08</span>Oportunidades<small>Top 100</small></button><button className={activeView === "quality" ? "active" : ""} onClick={() => setActiveView("quality")}><span>09</span>Qualidade<small>Cadastro</small></button><button className={activeView === "duplicates" ? "active" : ""} onClick={() => setActiveView("duplicates")}><span>10</span>Duplicidades<small>Sugestiva</small></button><button className={activeView === "timeline" ? "active" : ""} onClick={() => setActiveView("timeline")}><span>11</span>Timeline Nacional<small>Evolucao</small></button><button className={activeView === "digitalTwin" ? "active" : ""} onClick={() => setActiveView("digitalTwin")}><span>12</span>Digital Twin<small>Ativo inteligente</small></button><button className={activeView === "strategicPlanning" ? "active" : ""} onClick={() => setActiveView("strategicPlanning")}><span>13</span>Strategic Planning<small>Decisao</small></button><button className={activeView === "scenarioPlanner" ? "active" : ""} onClick={() => setActiveView("scenarioPlanner")}><span>14</span>Scenario Planner<small>Simulacao</small></button><button className={activeView === "advancedGis" ? "active" : ""} onClick={() => setActiveView("advancedGis")}><span>15</span>Advanced GIS<small>Geoanalise</small></button><button className={activeView === "executiveReports" ? "active" : ""} onClick={() => setActiveView("executiveReports")}><span>16</span>Executive Reports<small>PDF/CSV</small></button><button className={activeView === "executiveWorkspace" ? "active" : ""} onClick={() => setActiveView("executiveWorkspace")}><span>17</span>Executive Workspace<small>Diretoria</small></button><button className={activeView === "satellite" ? "active" : ""} onClick={() => setActiveView("satellite")}><span>18</span>Satellite Intelligence<small>Copernicus</small></button><button className={activeView === "dataTrust" ? "active" : ""} onClick={() => setActiveView("dataTrust")}><span>19</span>Data Trust<small>Confianca</small></button><button className={activeView === "sentinelCore" ? "active" : ""} onClick={() => setActiveView("sentinelCore")}><span>20</span>Sentinel Core<small>SIG</small></button></nav>
      {activeView === "mission" ? <MissionControl dashboard={data} onSelectSite={setSelectedSite} /> : activeView === "ai" ? <TelecomAIView /> : activeView === "rollout" ? <RolloutView /> : activeView === "alerts" ? <AlertCenterView /> : activeView === "market" ? <MarketView /> : activeView === "opportunities" ? <OpportunitiesView /> : activeView === "quality" ? <DataQualityView /> : activeView === "duplicates" ? <DuplicatesView /> : activeView === "timeline" ? <NationalTimelineView /> : activeView === "digitalTwin" ? <DigitalTwinView /> : activeView === "strategicPlanning" ? <StrategicPlanningView /> : activeView === "scenarioPlanner" ? <ScenarioPlannerView /> : activeView === "advancedGis" ? <AdvancedGisView /> : activeView === "executiveReports" ? <ExecutiveReportsView /> : activeView === "executiveWorkspace" ? <ExecutiveWorkspaceView /> : activeView === "satellite" ? <SatelliteIntelligenceView /> : activeView === "dataTrust" ? <DataTrustView /> : activeView === "sentinelCore" ? <SentinelCoreView /> : activeView === "executive" ? <>
        <SectionTitle index="01" eyebrow="EXECUTIVE OVERVIEW" title="Plataforma em numeros" description="Indicadores comerciais para leitura imediata da cobertura monitorada." actions={<><a className="export-button executive" href={exportUrl("executive")}>Exportar CSV</a><a className="export-button" href="/api/export?type=mission-control-pdf">Exportar PDF</a></>} />
        <section className={`cards executive-cards ${loading ? "muted" : ""}`}><article><span>Total de registros</span><strong>{nf.format(data?.summary.total || 0)}</strong><small>linhas operacionais</small></article><article><span>Sites unicos</span><strong>{nf.format(data?.summary.uniqueSites || 0)}</strong><small>ativos identificados</small></article><article className="danger"><span>Sites criticos</span><strong>{nf.format(data?.summary.criticalSites || 0)}</strong><small>GEO SCORE maximo &gt;= 81</small></article><article><span>Estados</span><strong>{nf.format(data?.summary.trackedStates || 0)}</strong><small>cobertura territorial</small></article><article><span>Municipios</span><strong>{nf.format(data?.summary.trackedMunicipalities || 0)}</strong><small>mercados locais</small></article><article><span>Tecnologias</span><strong>{nf.format(data?.summary.technologies || 0)}</strong><small>perfis tecnologicos</small></article></section>
        <SectionTitle index="02" eyebrow="RISK OVERVIEW" title="Exposicao executiva ao risco" description="Sites classificados pelo maior GEO SCORE observado na selecao atual." />
        <section className="risk-cards"><article className="risk-low"><span>Baixo</span><strong>{nf.format(data?.risk.low || 0)}</strong><small>0-30</small></article><article className="risk-medium"><span>Medio</span><strong>{nf.format(data?.risk.medium || 0)}</strong><small>31-60</small></article><article className="risk-high"><span>Alto</span><strong>{nf.format(data?.risk.high || 0)}</strong><small>61-80</small></article><article className="risk-critical"><span>Critico</span><strong>{nf.format(data?.risk.critical || 0)}</strong><small>81-100</small></article><article className="risk-percent"><span>Percentual critico</span><strong>{data?.risk.criticalPercent || 0}%</strong><small>dos sites unicos</small></article></section>
        <section className="intelligence-grid"><VolumeRanking eyebrow="TOP ESTADOS CRITICOS" title="Pressao de risco por estado" data={data?.risk.states || []} /><VolumeRanking eyebrow="TOP MUNICIPIOS CRITICOS" title="Pressao de risco municipal" data={data?.risk.municipalities || []} /></section>
        <SectionTitle index="03" eyebrow="INFRASTRUCTURE INTELLIGENCE" title="Quem detem e como a rede se sustenta" description="Perfil dos detentores, tipologias e dimensao fisica das estruturas." />
        <section className="infrastructure-grid"><Donut title="Top detentores de infraestrutura" data={data?.breakdowns.detentor || []} /><Donut title="Tipos de infraestrutura" data={data?.breakdowns.infra || []} /><article className="panel average-height-card"><p className="eyebrow">ALTURA MEDIA</p><strong>{(data?.summary.averageHeight || 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}<small> m</small></strong><span>estruturas com altura informada</span><i /></article></section>
        <TallestStructures data={data?.intelligence.tallest || []} />
        <SectionTitle index="04" eyebrow="INTELIGENCIA TELECOM" title="Concentracao e perfil da rede" description="Camada analitica preservada: territorio, tecnologia, status e alturas medias." />
        <section className="intelligence-grid"><VolumeRanking eyebrow="TOP MUNICIPIOS" title="Concentracao municipal" data={data?.intelligence.municipalities || []} /><VolumeRanking eyebrow="TOP ESTADOS" title="Concentracao estadual" data={data?.intelligence.states || []} /></section>
        <section className="charts telecom-charts"><Donut title="Distribuicao por tecnologia" data={data?.breakdowns.tecnologia || []} /><Donut title="Distribuicao por status" data={data?.breakdowns.status || []} /></section>
        <section className="intelligence-grid"><AverageRanking eyebrow="ALTURA MEDIA POR UF" title="Verticalizacao estadual" data={data?.intelligence.averageHeightByState || []} /><AverageRanking eyebrow="ALTURA MEDIA POR DETENTOR" title="Perfil estrutural dos detentores" data={data?.intelligence.averageHeightByHolder || []} /></section>
        <SectionTitle index="05" eyebrow="RANKING GEO" title="Prioridade operacional" description="Sites priorizados pelo GEO SCORE." actions={<><a className="export-button" href={exportUrl("ranking")}>Exportar ranking CSV</a><a className="export-button critical" href={exportUrl("critical")}>Exportar criticos CSV</a></>} />
        <section className="panel ranking executive-ranking"><div className="panel-head"><div><p className="eyebrow">PRIORIDADE</p><h2>Ranking GEO SCORE</h2></div><span>SCORE</span></div>{(data?.ranking || []).map((site, index) => <div className="rank-row" key={site.id}><b>{String(index + 1).padStart(2, "0")}</b><div><strong>{site.siteId}</strong><small>{site.municipio} · {site.estado} · {site.tecnologia}</small></div><span className={`score ${slug(site.risco)}`}>{site.geoScore}</span></div>)}</section>
        <SectionTitle index="06" eyebrow="MAPA" title="Leitura territorial" description="Distribuicao geografica dos ativos da selecao atual." />
        <section className="panel map-panel"><div className="panel-head"><div><p className="eyebrow">MALHA NACIONAL</p><h2>Mapa de ativos <CapabilityBadge capabilityKey="site_mapping" /></h2><CapabilityNote capabilityKey="site_mapping" /></div><div className="map-note">{data?.meta.sampled ? "Amostra visual de ate 4.000 pontos" : "Todos os pontos"}</div></div><MapView points={data?.points || []} onSelect={setSelectedSite} /><div className="risk-legend">{["Baixo", "Medio", "Alto", "Critico"].map((item) => <span key={item} className={slug(item)}><i />{item}</span>)}</div></section>
        <SectionTitle index="07" eyebrow="TABELA" title="Inventario detalhado" description="Consulta operacional paginada." />
        <section className="panel table-panel"><div className="panel-head"><div><p className="eyebrow">INVENTARIO FILTRADO</p><h2>Detalhamento dos sites</h2></div><span>{nf.format(data?.pagination.total || 0)} resultados</span></div><div className="table-scroll"><table><thead><tr><th>Site</th><th>Operadora</th><th>Localidade</th><th>Tecnologia</th><th>Status</th><th>Endereco</th><th>Infra</th><th>GEO SCORE</th><th>Acoes</th></tr></thead><tbody>{(data?.table || []).map((site) => <tr key={site.id}><td><strong>{site.site}</strong><small>{site.elemento}</small></td><td>{site.operadoraOrigem}</td><td>{site.municipio}<small>{site.uf}</small></td><td>{site.tecnologia}</td><td>{site.status}</td><td>{site.endereco}</td><td>{site.tipoInfra}</td><td><span className={`badge ${slug(site.risco)}`}>{site.geoScore} · {site.risco}</span></td><td><button className="table-action" type="button" onClick={() => setSelectedSite(site)}>Painel</button></td></tr>)}</tbody></table></div><div className="pagination"><button disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)}>Anterior</button><span>Pagina {data?.pagination.page || 1} de {data?.pagination.pages || 1}</span><button disabled={page >= (data?.pagination.pages || 1) || loading} onClick={() => setPage((value) => value + 1)}>Proxima</button></div></section>
      </> : <OperatorView data={data} exportUrl={exportUrl} onSelectSite={setSelectedSite} />}
      <footer><div><strong>Sentinel-1 Enterprise</strong> · SQLite Online · SIG · Copernicus · Data Trust</div><span>{(data?.pagination.total || 0).toLocaleString("pt-BR")} registros · Fonte: {data?.meta.sourceName || "Excel local"}</span></footer>
    </div>
    {selectedSite ? <SiteIntelligencePanel site={selectedSite} onClose={() => setSelectedSite(null)} /> : null}
  </main>;
}
