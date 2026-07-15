"use client";

import { useEffect, useState } from "react";

const nf = new Intl.NumberFormat("pt-BR");

function useApi<T>(url: string, tick = 0) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    fetch(url).then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Falha Sentinel Core");
      if (active) setData(body);
    }).catch((err) => active && setError(err instanceof Error ? err.message : "Falha Sentinel Core"));
    return () => { active = false; };
  }, [url, tick]);
  return { data, error };
}

export function SentinelCoreView() {
  const [tick, setTick] = useState(0);
  const [query, setQuery] = useState("TIM");
  const { data: status } = useApi<any>("/api/sentinel-core/status", tick);
  const { data: insights } = useApi<any>("/api/sentinel-core/insights?scope=global", tick);
  const { data: recommendations } = useApi<any>("/api/sentinel-core/recommendations?scope=global", tick);
  const { data: search } = useApi<any>(`/api/sentinel-core/search?q=${encodeURIComponent(query)}`, tick);
  const build = async () => {
    await fetch("/api/sentinel-core/build", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ limit: 1000, reset: true }) });
    setTick((value) => value + 1);
  };
  return <section className="s2b-view">
    <div className="s2b-hero panel"><div><p className="eyebrow">SENTINEL CORE</p><h2>Sentinel Intelligence Graph</h2><p>Camada central de conhecimento conectando sites, municipios, operadoras, tecnologias, trust, Copernicus e evidencias.</p></div><a href="/api/export?type=sentinel-graph-nodes">Exportar Nos</a></div>
    <div className="s2b-kpis">
      <article className="panel"><span>Status SIG</span><strong>{status?.status || "EMPTY"}</strong></article>
      <article className="panel"><span>Nos</span><strong>{nf.format(status?.nodes || 0)}</strong></article>
      <article className="panel"><span>Relacoes</span><strong>{nf.format(status?.edges || 0)}</strong></article>
      <article className="panel"><span>Insights</span><strong>{nf.format(status?.insights || 0)}</strong></article>
    </div>
    <div className="s4-form panel"><button onClick={build}>Build Graph Sample 1000</button><a className="export-button" href="/api/export?type=sentinel-graph-edges">Edges CSV</a><a className="export-button" href="/api/export?type=sentinel-graph-insights">Insights CSV</a><a className="export-button" href="/api/export?type=sentinel-graph-recommendations">Recomendacoes CSV</a></div>
    <div className="s2b-chat panel"><div className="s2b-question"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar conhecimento..." /><button onClick={() => setTick((value) => value + 1)}>Buscar</button></div></div>
    <div className="s2b-rows">{(search?.results || []).slice(0, 12).map((row: any) => <div key={row.nodeId}><span><small>node</small><strong>{row.nodeId}</strong></span><span><small>tipo</small><strong>{row.nodeType}</strong></span><span><small>label</small><strong>{row.label}</strong></span></div>)}</div>
    <div className="s2b-rows">{(insights?.insights || []).slice(0, 10).map((row: any) => <div key={`${row.insightType}-${row.scopeId}-${row.title}`}><span><small>insight</small><strong>{row.title}</strong></span><span><small>score</small><strong>{row.score}</strong></span><span><small>recomendacao</small><strong>{row.recommendation}</strong></span></div>)}</div>
    <div className="s2b-rows">{(recommendations?.recommendations || []).slice(0, 10).map((row: any, index: number) => <div key={`${row.type}-${index}`}><span><small>tipo</small><strong>{row.type}</strong></span><span><small>prioridade</small><strong>{row.priority}</strong></span><span><small>acao</small><strong>{row.title}</strong></span></div>)}</div>
  </section>;
}
