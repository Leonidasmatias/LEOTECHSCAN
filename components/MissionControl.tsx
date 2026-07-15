"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import Donut from "./Donut";
import type { DashboardData, MissionControlData, SiteRow, StrategicMunicipality } from "@/lib/types";

const MapView = dynamic(() => import("./MapView"), { ssr: false, loading: () => <div className="map-loading">Carregando Mission Map...</div> });
const nf = new Intl.NumberFormat("pt-BR");

function RankList({ title, data, value, suffix = "" }: { title: string; data: StrategicMunicipality[]; value: "records" | "sites" | "tci" | "opi" | "sri" | "lts"; suffix?: string }) {
  const readValue = (item: StrategicMunicipality) => value === "sri" || value === "lts" ? item[value].score : item[value];
  return <section className="panel mission-rank"><div className="panel-head"><div><p className="eyebrow">RANKING</p><h3>{title}</h3></div><span>TOP 10</span></div>{data.slice(0, 10).map((item, index) => <div className="mission-rank-row" key={`${title}-${item.uf}-${item.municipio}`}><b>{String(index + 1).padStart(2, "0")}</b><span>{item.municipio}<small>{item.uf} · {nf.format(item.sites)} sites · {item.operators} operadora(s)</small></span><strong>{nf.format(readValue(item))}{suffix}</strong></div>)}</section>;
}

export default function MissionControl({ dashboard, onSelectSite }: { dashboard?: DashboardData; onSelectSite: (site: SiteRow) => void }) {
  const [mission, setMission] = useState<MissionControlData>();
  const [sig, setSig] = useState<{ status: string; nodes: number; edges: number; insights: number }>();
  const [error, setError] = useState("");
  const [mapMode, setMapMode] = useState<"points" | "heatmap">("heatmap");

  useEffect(() => {
    let active = true;
    fetch("/api/mission-control").then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Mission Control indisponivel");
      if (active) setMission(body);
    }).catch((err) => active && setError(err instanceof Error ? err.message : "Falha ao carregar Mission Control"));
    fetch("/api/sentinel-core/status").then((response) => response.json()).then((body) => { if (active) setSig(body); }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  const operatorDonut = useMemo(() => (mission?.distributions.operators || []).map((item) => ({ label: String(item.operator), value: Number(item.records || 0) })), [mission]);
  const ufDonut = useMemo(() => (mission?.distributions.byUf || []).slice(0, 12).map((item) => ({ label: item.label, value: item.records })), [mission]);
  const tim = mission?.distributions.operators.find((item) => item.operator === "TIM");
  const vivo = mission?.distributions.operators.find((item) => item.operator === "VIVO");

  return <div className="mission-control">
    <section className="mission-hero panel"><div><p className="eyebrow">SENTINEL-1 V2 · MISSION CONTROL</p><h1>Centro de comando telecom.</h1><p>Leitura executiva da cobertura, risco, oportunidade e performance territorial consolidada em SQLite local.</p></div><div className="mission-status"><span className={mission?.status.database === "ok" ? "ok" : "warn"}>Banco {mission?.status.database || "..."}</span><span className={mission?.status.api === "ok" ? "ok" : "warn"}>APIs {mission?.status.api || "..."}</span><small>{mission?.status.apiMs ?? 0} ms</small></div></section>
    {error ? <section className="error">{error}</section> : null}
    <section className="mission-kpis">
      <article className="panel"><span>Total de Sites</span><strong>{nf.format(mission?.kpis.totalSites || 0)}</strong><small>ativos unicos</small></article>
      <article className="panel"><span>Operadoras</span><strong>{nf.format(mission?.kpis.totalOperators || 0)}</strong><small>TIM, VIVO e futuras</small></article>
      <article className="panel"><span>Municipios</span><strong>{nf.format(mission?.kpis.totalMunicipalities || 0)}</strong><small>{nf.format(mission?.kpis.totalStates || 0)} UFs</small></article>
      <article className="panel"><span>Registros</span><strong>{nf.format(mission?.kpis.totalRecords || 0)}</strong><small>linhas consolidadas</small></article>
      <article className="panel"><span>LTS Medio</span><strong>{mission?.kpis.avgLts || 0}</strong><small>Leonidas Telecom Score</small></article>
      <article className="panel danger"><span>Alertas</span><strong>{nf.format(mission?.kpis.alerts || 0)}</strong><small>SRI critico ou LTS baixo</small></article>
      <article className="panel"><span>Cobertura</span><strong>{nf.format(mission?.cards.coverage || 0)}</strong><small>UFs com presenca</small></article>
      <article className="panel"><span>Crescimento</span><strong>{nf.format(mission?.cards.growth || 0)}</strong><small>ultima carga</small></article>
      <article className="panel"><span>Sentinel Core</span><strong>{sig?.status || "EMPTY"}</strong><small>{nf.format(sig?.nodes || 0)} nos Â· {nf.format(sig?.edges || 0)} relacoes</small></article>
    </section>
    <section className="mission-grid">
      <section className="panel map-panel mission-map"><div className="panel-head"><div><p className="eyebrow">MAPA DO BRASIL</p><h2>{mapMode === "heatmap" ? "Heatmap nacional" : "Sites monitorados"}</h2></div><div className="map-toggle"><button className={mapMode === "points" ? "active" : ""} onClick={() => setMapMode("points")}>Pontos</button><button className={mapMode === "heatmap" ? "active" : ""} onClick={() => setMapMode("heatmap")}>Heatmap</button></div></div><MapView points={dashboard?.points || []} mode={mapMode} onSelect={onSelectSite} /></section>
      <section className="mission-side"><Donut title="Participacao por operadora" data={operatorDonut} /><Donut title="Distribuicao por UF" data={ufDonut} /><section className="panel last-imports"><div className="panel-head"><div><p className="eyebrow">IMPORTACOES</p><h3>Ultimas importacoes</h3></div></div>{(mission?.imports || []).map((item) => <div key={`${item.arquivo_origem}-${item.operadora}`}><strong>{String(item.operadora)}</strong><span>{String(item.arquivo_origem)} · {nf.format(Number(item.linhas_importadas || 0))}</span></div>)}</section></section>
    </section>
    <section className="executive-compare panel"><div className="panel-head"><div><p className="eyebrow">DASHBOARD EXECUTIVO</p><h2>Comparativo TIM x VIVO</h2></div><div className="operator-actions"><a href="/api/export?type=mission-control-csv">Exportar CSV</a><a href="/api/export?type=mission-control-pdf">Exportar PDF</a></div></div><div className="compare-bars"><div><span>TIM</span><strong>{nf.format(Number(tim?.records || 0))}</strong><i style={{ width: `${Math.min(100, Number(tim?.records || 0) / Math.max(Number(tim?.records || 0), Number(vivo?.records || 0), 1) * 100)}%` }} /></div><div><span>VIVO</span><strong>{nf.format(Number(vivo?.records || 0))}</strong><i style={{ width: `${Math.min(100, Number(vivo?.records || 0) / Math.max(Number(tim?.records || 0), Number(vivo?.records || 0), 1) * 100)}%` }} /></div></div></section>
    <section className="mission-rank-grid">
      <RankList title="Ranking Nacional LTS" data={mission?.rankings.national || []} value="lts" />
      <RankList title="Ranking Estadual TCI" data={mission?.rankings.state || []} value="tci" />
      <RankList title="Top Municipios" data={mission?.rankings.topMunicipalities || []} value="records" />
      <RankList title="Opportunity Potential Index" data={mission?.rankings.opi || []} value="opi" />
      <RankList title="Sentinel Risk Index" data={mission?.rankings.sri || []} value="sri" />
    </section>
  </div>;
}
