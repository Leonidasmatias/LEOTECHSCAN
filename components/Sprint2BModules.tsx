"use client";

import { useEffect, useState } from "react";
import { CapabilityBadge, CapabilityNote } from "@/components/CapabilityBadge";

const nf = new Intl.NumberFormat("pt-BR");

function useApi<T>(url: string) {
  const [data, setData] = useState<T>();
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

function JsonRows({ rows }: { rows?: Array<Record<string, unknown>> }) {
  return <div className="s2b-rows">{(rows || []).slice(0, 12).map((row, index) => <div key={index}>{Object.entries(row).slice(0, 7).map(([key, value]) => <span key={key}><small>{key}</small><strong>{String(value)}</strong></span>)}</div>)}</div>;
}

export function TelecomAIView() {
  const [question, setQuestion] = useState("Gerar resumo executivo nacional");
  const [submitted, setSubmitted] = useState(question);
  const { data, error } = useApi<{ answer: string; intent: string; rows: Array<Record<string, unknown>> }>(`/api/telecom-ai?q=${encodeURIComponent(submitted)}`);
  const examples = ["Quais municipios possuem maior quantidade de sites?", "Quais municipios ainda nao possuem 5G?", "Mostrar apenas municipios da VIVO.", "Listar municipios prioritarios para expansao.", "Qual municipio possui maior Leonidas Telecom Score?"];
  return <section className="s2b-view"><div className="s2b-hero panel"><div><p className="eyebrow">TELECOM AI</p><h2>Consulta inteligente local <CapabilityBadge capabilityKey="telecom_ai" /></h2><p>Engine por regras sobre SQLite, preparada para futura IA generativa.</p><CapabilityNote capabilityKey="telecom_ai" /></div><a href={`/api/export?type=telecom-ai-report&q=${encodeURIComponent(submitted)}`}>Exportar CSV</a></div><div className="s2b-chat panel"><div className="s2b-question"><input value={question} onChange={(event) => setQuestion(event.target.value)} /><button onClick={() => setSubmitted(question)}>Perguntar</button></div><div className="s2b-examples">{examples.map((item) => <button key={item} onClick={() => { setQuestion(item); setSubmitted(item); }}>{item}</button>)}</div>{error ? <p className="error">{error}</p> : null}<article><span>{data?.intent || "intent"}</span><strong>{data?.answer || "Carregando resposta..."}</strong></article><JsonRows rows={data?.rows} /></div></section>;
}

export function RolloutView() {
  const { data, error } = useApi<{ national: Array<Record<string, unknown>>; summary: { total: number; veryHigh: number } }>("/api/rollout");
  return <section className="s2b-view"><div className="s2b-hero panel"><div><p className="eyebrow">ROLLOUT INTELLIGENCE</p><h2>Planejamento operacional <CapabilityBadge capabilityKey="rollout_intelligence" /></h2><p>Estimativa de novos sites, equipes, MOS, instalacoes e prioridade.</p><CapabilityNote capabilityKey="rollout_intelligence" /></div><a href="/api/export?type=rollout-intelligence">Exportar CSV</a></div>{error ? <p className="error">{error}</p> : null}<div className="s2b-kpis"><article className="panel"><span>Municipios avaliados</span><strong>{nf.format(data?.summary.total || 0)}</strong></article><article className="panel danger"><span>Prioridade muito alta</span><strong>{nf.format(data?.summary.veryHigh || 0)}</strong></article></div><JsonRows rows={data?.national} /></section>;
}

export function AlertCenterView() {
  const { data, error } = useApi<{ alerts: Array<Record<string, unknown>>; summary: { total: number; critical: number; high: number } }>("/api/alerts");
  return <section className="s2b-view"><div className="s2b-hero panel"><div><p className="eyebrow">ALERT CENTER</p><h2>Alertas territoriais <CapabilityBadge capabilityKey="alert_center" /></h2><p>Baixa cobertura, municipios sem 5G, operadora unica e risco critico.</p><CapabilityNote capabilityKey="alert_center" /></div><a href="/api/export?type=alert-center">Exportar CSV</a></div>{error ? <p className="error">{error}</p> : null}<div className="s2b-kpis"><article className="panel danger"><span>Total alertas</span><strong>{nf.format(data?.summary.total || 0)}</strong></article><article className="panel"><span>Criticos</span><strong>{nf.format(data?.summary.critical || 0)}</strong></article><article className="panel"><span>Altos</span><strong>{nf.format(data?.summary.high || 0)}</strong></article></div><JsonRows rows={data?.alerts} /></section>;
}

export function MarketView() {
  const { data, error } = useApi<{ operators: Array<Record<string, unknown>>; byUf: Array<Record<string, unknown>>; byTechnology: Array<Record<string, unknown>>; comparisons: Record<string, Record<string, unknown>> }>("/api/market");
  return <section className="s2b-view"><div className="s2b-hero panel"><div><p className="eyebrow">MARKET INTELLIGENCE</p><h2>Participacao e comparativos <CapabilityBadge capabilityKey="market_intelligence" /></h2><p>TIM x VIVO, distribuicao tecnologica, ranking de operadoras e presenca territorial.</p><CapabilityNote capabilityKey="market_intelligence" /></div><a href="/api/export?type=market-intelligence">Exportar CSV</a></div>{error ? <p className="error">{error}</p> : null}<div className="s2b-kpis">{(data?.operators || []).map((item) => <article className="panel" key={String(item.operator)}><span>{String(item.operator)}</span><strong>{nf.format(Number(item.records || 0))}</strong><small>{nf.format(Number(item.sites || 0))} sites</small></article>)}</div><JsonRows rows={data?.byUf} /><JsonRows rows={data?.byTechnology} /></section>;
}

export function OpportunitiesView() {
  const { data, error } = useApi<{ opportunities: Array<Record<string, unknown>>; summary: { total: number; top: Record<string, unknown> | null } }>("/api/opportunities");
  return <section className="s2b-view"><div className="s2b-hero panel"><div><p className="eyebrow">OPORTUNIDADES</p><h2>Top 100 municipios prioritarios <CapabilityBadge capabilityKey="opportunities" /></h2><p>Ranking orientado por Opportunity Index, LTS, cobertura e densidade.</p><CapabilityNote capabilityKey="opportunities" /></div><a href="/api/export?type=municipios-prioritarios">Exportar CSV</a></div>{error ? <p className="error">{error}</p> : null}<div className="s2b-kpis"><article className="panel"><span>Total no ranking</span><strong>{nf.format(data?.summary.total || 0)}</strong></article><article className="panel danger"><span>Top oportunidade</span><strong>{String(data?.summary.top?.municipio || "-")}</strong></article></div><JsonRows rows={data?.opportunities} /></section>;
}
