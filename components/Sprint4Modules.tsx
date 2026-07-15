"use client";

import { useEffect, useState } from "react";
import { CopernicusSiteEvidence } from "./CopernicusModules";
import { EvidenceCenterPanel, SiteTrustPanel } from "./DataTrustModules";

const nf = new Intl.NumberFormat("pt-BR");

function useApi<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    fetch(url).then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Falha na API");
      if (active) setData(body);
    }).catch((err) => active && setError(err instanceof Error ? err.message : "Falha"));
    return () => { active = false; };
  }, [url]);
  return { data, error };
}

function Rows({ rows }: { rows?: Array<Record<string, unknown>> }) {
  return <div className="s2b-rows">{(rows || []).slice(0, 12).map((row, index) => <div key={index}>{Object.entries(row).slice(0, 7).map(([key, value]) => <span key={key}><small>{key}</small><strong>{typeof value === "object" ? JSON.stringify(value).slice(0, 80) : String(value)}</strong></span>)}</div>)}</div>;
}

function V3Hero({ eyebrow, title, text, exportUrl }: { eyebrow: string; title: string; text: string; exportUrl?: string }) {
  return <div className="s2b-hero panel"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2><p>{text}</p></div>{exportUrl ? <a href={exportUrl}>Exportar CSV</a> : null}</div>;
}

export function DigitalTwinView() {
  const [siteId, setSiteId] = useState("1");
  const [submitted, setSubmitted] = useState("1");
  const { data, error } = useApi<any>(`/api/digital-twin/site?id=${encodeURIComponent(submitted)}`);
  return <section className="s2b-view"><V3Hero eyebrow="DIGITAL TWIN TELECOM" title="Ativo inteligente do site" text="Visao operacional e estrategica do site, baseada nos dados disponiveis no SQLite." exportUrl={`/api/export?type=digital-twin-sites&id=${submitted}`} />
    <div className="s2b-chat panel"><div className="s2b-question"><input value={siteId} onChange={(event) => setSiteId(event.target.value)} placeholder="ID do site" /><button onClick={() => setSubmitted(siteId)}>Abrir Twin</button></div>{error ? <p className="error">{error}</p> : null}<article><span>{data?.site?.operadoraOrigem || "site"}</span><strong>{data?.site?.site || "Carregando Digital Twin..."}</strong></article></div>
    <div className="s2b-kpis"><article className="panel"><span>LTS</span><strong>{data?.scores?.lts?.score ?? "-"}</strong></article><article className="panel"><span>TCI</span><strong>{data?.scores?.tci ?? "-"}</strong></article><article className="panel"><span>OPI</span><strong>{data?.scores?.opi ?? "-"}</strong></article><article className="panel danger"><span>SRI</span><strong>{data?.scores?.sri?.score ?? "-"}</strong></article></div>
    <SiteTrustPanel siteId={Number(submitted || 1)} />
    <CopernicusSiteEvidence siteId={Number(submitted || 1)} />
    <EvidenceCenterPanel siteId={Number(submitted || 1)} />
    <Rows rows={[{ risco: data?.risk, oportunidade: data?.opportunity, recomendacao: data?.strategicRecommendation }]} /><Rows rows={data?.nearbySites} />
  </section>;
}

export function StrategicPlanningView() {
  const [form, setForm] = useState({ operadora: "VIVO", uf: "SP", municipio: "", tecnologia: "5G", metaNovosSites: 100, horizonteDias: 120 });
  const [data, setData] = useState<any>();
  const run = async () => {
    const response = await fetch("/api/strategic-planning", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setData(await response.json());
  };
  useEffect(() => { run(); }, []);
  return <section className="s2b-view"><V3Hero eyebrow="STRATEGIC PLANNING" title="Plano estimado de expansao" text="Distribui meta de novos sites por municipio prioritario, equipes, MOS, custo e risco." exportUrl={`/api/export?type=strategic-planning&operadora=${form.operadora}&uf=${form.uf}&tecnologia=${form.tecnologia}&meta=${form.metaNovosSites}&horizonte=${form.horizonteDias}`} />
    <div className="s4-form panel">{Object.entries(form).map(([key, value]) => <label key={key}><span>{key}</span><input value={String(value)} onChange={(event) => setForm((old) => ({ ...old, [key]: key.includes("meta") || key.includes("horizonte") ? Number(event.target.value) : event.target.value }))} /></label>)}<button onClick={run}>Simular Plano</button></div>
    <div className="s2b-kpis"><article className="panel"><span>Equipes</span><strong>{data?.estimates?.teams ?? "-"}</strong></article><article className="panel"><span>MOS</span><strong>{data?.estimates?.mos ?? "-"}</strong></article><article className="panel"><span>Instalacoes</span><strong>{data?.estimates?.installations ?? "-"}</strong></article><article className="panel danger"><span>Custo</span><strong>{nf.format(data?.estimates?.estimatedCost || 0)}</strong></article></div>
    <Rows rows={data?.distribution} />
  </section>;
}

export function ScenarioPlannerView() {
  const [form, setForm] = useState({ operadora: "VIVO", uf: "SP", tecnologia: "5G", metaNovosSites: 100, horizonteDias: 120 });
  const [data, setData] = useState<any>();
  const run = async () => {
    const response = await fetch("/api/scenario-planner", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setData(await response.json());
  };
  useEffect(() => { run(); }, []);
  return <section className="s2b-view"><V3Hero eyebrow="SCENARIO PLANNER" title="Simulador de impacto" text="Compara antes e depois para LTS, TCI, OPI e market share." exportUrl={`/api/export?type=scenario-planner&operadora=${form.operadora}&uf=${form.uf}&tecnologia=${form.tecnologia}&meta=${form.metaNovosSites}`} />
    <div className="s4-form panel">{Object.entries(form).map(([key, value]) => <label key={key}><span>{key}</span><input value={String(value)} onChange={(event) => setForm((old) => ({ ...old, [key]: key.includes("meta") || key.includes("horizonte") ? Number(event.target.value) : event.target.value }))} /></label>)}<button onClick={run}>Simular Cenario</button></div>
    <div className="s2b-kpis"><article className="panel"><span>Share antes</span><strong>{data?.before?.marketShare ?? "-"}%</strong></article><article className="panel"><span>Share depois</span><strong>{data?.after?.marketShare ?? "-"}%</strong></article><article className="panel"><span>Impacto LTS</span><strong>{data?.impacts?.lts ?? "-"}</strong></article><article className="panel"><span>Impacto OPI</span><strong>{data?.impacts?.opi ?? "-"}</strong></article></div>
    <Rows rows={data?.benefitedMunicipalities} />
  </section>;
}

export function AdvancedGisView() {
  const [siteId, setSiteId] = useState("1");
  const [radius, setRadius] = useState("30");
  const [submitted, setSubmitted] = useState({ siteId: "1", radius: "30" });
  const { data, error } = useApi<any>(`/api/geointelligence?siteId=${submitted.siteId}&radiusKm=${submitted.radius}`);
  return <section className="s2b-view"><V3Hero eyebrow="ADVANCED GIS" title="Geointeligencia avancada" text="Raio configuravel, proximidade, clusters por operadora/tecnologia e camadas estrategicas." exportUrl={`/api/export?type=advanced-geointelligence&id=${submitted.siteId}&radiusKm=${submitted.radius}`} />
    <div className="s2b-chat panel"><div className="s2b-question"><input value={siteId} onChange={(event) => setSiteId(event.target.value)} /><input value={radius} onChange={(event) => setRadius(event.target.value)} /><button onClick={() => setSubmitted({ siteId, radius })}>Analisar Raio</button></div>{error ? <p className="error">{error}</p> : null}</div>
    <div className="s2b-kpis"><article className="panel"><span>Raio km</span><strong>{data?.radiusKm ?? "-"}</strong></article><article className="panel"><span>Sites no raio</span><strong>{nf.format(data?.sitesWithinRadius?.length || 0)}</strong></article><article className="panel"><span>Municipios prox.</span><strong>{nf.format(data?.nearbyMunicipalities?.length || 0)}</strong></article></div>
    <Rows rows={data?.clusters?.byOperator} /><Rows rows={data?.sitesWithinRadius} />
  </section>;
}

export function ExecutiveReportsView() {
  const reports = ["resumo-executivo-nacional", "comparativo-tim-vivo", "oportunidades-expansao", "qualidade-cadastral", "planejamento-rollout", "alertas-criticos", "ranking-municipios", "strategic-planning-report", "scenario-planner-report", "copernicus-site-validation"];
  return <section className="s2b-view"><V3Hero eyebrow="EXECUTIVE REPORTS" title="Relatorios executivos locais" text="PDF e CSV gerados localmente em C:\\LEOTECHSCAN\\EXPORTACOES." />
    <div className="s4-reports">{reports.map((item) => <article className="panel" key={item}><strong>{item}</strong><div><a href={`/api/executive-reports?type=${item}&format=csv`}>CSV</a><a href={`/api/executive-reports?type=${item}&format=pdf`}>PDF</a></div></article>)}</div>
  </section>;
}

export function ExecutiveWorkspaceView() {
  const { data, error } = useApi<any>("/api/executive-workspace");
  return <section className="s2b-view"><V3Hero eyebrow="EXECUTIVE WORKSPACE" title="Tela executiva da diretoria" text="KPIs nacionais, recomendacoes, alertas, oportunidades, comparativos e timeline." exportUrl="/api/executive-reports?type=resumo-executivo-nacional&format=csv" />
    {error ? <p className="error">{error}</p> : null}
    <div className="s2b-kpis"><article className="panel"><span>Registros</span><strong>{nf.format(data?.kpis?.records || 0)}</strong></article><article className="panel"><span>Sites</span><strong>{nf.format(data?.kpis?.sites || 0)}</strong></article><article className="panel"><span>Municipios</span><strong>{nf.format(data?.kpis?.municipalities || 0)}</strong></article><article className="panel danger"><span>Impacto potencial</span><strong>{nf.format(data?.potentialExpansionImpact || 0)}</strong></article></div>
    <Rows rows={data?.criticalAlerts} /><Rows rows={data?.topOpportunities} />
  </section>;
}
