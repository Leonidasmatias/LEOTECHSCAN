"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import type { DashboardData, OperatorMetric, SiteRow } from "@/lib/types";

const MapView = dynamic(() => import("./MapView"), { ssr: false, loading: () => <div className="map-loading">Carregando concentração nacional…</div> });
const nf = new Intl.NumberFormat("pt-BR");
const operatorClass = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "-").toLowerCase();

function RankTable({ title, eyebrow, data, value, suffix = "" }: { title: string; eyebrow: string; data: OperatorMetric[]; value: keyof OperatorMetric; suffix?: string }) {
  return <section className="panel operator-rank"><div className="panel-head"><div><p className="eyebrow">{eyebrow}</p><h3>{title}</h3></div><span>RANKING</span></div>{data.map((item, index) => <div className="operator-rank-row" key={item.operator}><b>{String(index + 1).padStart(2, "0")}</b><span><i className={operatorClass(item.operator)} />{item.operator}</span><strong>{typeof item[value] === "number" ? Number(item[value]).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : item[value]}{suffix}</strong></div>)}</section>;
}

export default function OperatorView({ data, exportUrl, onSelectSite }: { data?: DashboardData; exportUrl: (type: "operator-intelligence" | "ori-ranking" | "tci-ranking") => string; onSelectSite?: (site: SiteRow) => void }) {
  const [mapMode, setMapMode] = useState<"points" | "heatmap">("heatmap");
  return <div className="operator-view">
    <div className="operator-hero"><div><p className="eyebrow">OPERATOR INTELLIGENCE · V1.3</p><h2>Inteligência por operadora<br /><em>e infraestrutura.</em></h2><p>Classificação configurável, cobertura territorial e índices comparáveis em uma única visão.</p></div><div className="operator-actions"><a href={exportUrl("operator-intelligence")}>↓ Operator Intelligence CSV</a><a href={exportUrl("ori-ranking")}>↓ ORI Ranking CSV</a><a href={exportUrl("tci-ranking")}>↓ TCI Ranking CSV</a></div></div>

    <section className="operator-cards">{(data?.operators.cards || []).filter(item => item.operator !== "Outros").map(item => <article className={`panel ${operatorClass(item.operator)}`} key={item.operator}><span>{item.operator === "Não Identificado" ? "Não Identificados" : `Total ${item.operator}`}</span><strong>{nf.format(item.records)}</strong><small>{nf.format(item.sites)} sites únicos</small><i /></article>)}</section>

    <div className="operator-section-title"><span>01</span><div><p className="eyebrow">COBERTURA TERRITORIAL</p><h2>Presença e escala operacional</h2></div></div>
    <section className="panel operator-matrix"><div className="table-scroll"><table><thead><tr><th>Operadora</th><th>Registros</th><th>Sites únicos</th><th>Estados</th><th>Municípios</th><th>Tecnologias</th><th>Altura média</th><th>GEO médio</th><th>ORI médio</th><th>TCI</th></tr></thead><tbody>{(data?.operators.metrics || []).map(item => <tr key={item.operator}><td><strong><i className={`operator-dot ${operatorClass(item.operator)}`} />{item.operator}</strong></td><td>{nf.format(item.records)}</td><td>{nf.format(item.sites)}</td><td>{item.states}</td><td>{nf.format(item.municipalities)}</td><td>{item.technologies}</td><td>{item.averageHeight.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} m</td><td>{item.averageGeo}</td><td>{item.averageOri}</td><td><b className="tci-pill">{item.tci}</b></td></tr>)}</tbody></table></div></section>

    <div className="operator-section-title"><span>02</span><div><p className="eyebrow">ÍNDICES COMPARÁVEIS</p><h2>Ranking Operadoras · Cobertura · ORI · TCI</h2></div></div>
    <section className="operator-rank-grid"><RankTable eyebrow="RANKING OPERADORAS" title="Volume de registros" data={data?.operators.metrics || []} value="records" /><RankTable eyebrow="RANKING COBERTURA" title="Sites únicos" data={[...(data?.operators.metrics || [])].sort((a,b) => b.sites-a.sites)} value="sites" /><RankTable eyebrow="OPERATOR RISK INDEX" title="Risco médio ORI" data={data?.operators.oriRanking || []} value="averageOri" /><RankTable eyebrow="TELECOM COVERAGE INDEX" title="Cobertura TCI" data={data?.operators.tciRanking || []} value="tci" /></section>

    <div className="operator-section-title"><span>03</span><div><p className="eyebrow">HEATMAP NACIONAL</p><h2>Concentração de sites</h2></div><div className="map-toggle"><button className={mapMode === "points" ? "active" : ""} onClick={() => setMapMode("points")}>Pontos</button><button className={mapMode === "heatmap" ? "active" : ""} onClick={() => setMapMode("heatmap")}>Heatmap</button></div></div>
    <section className="panel map-panel operator-map"><div className="panel-head"><div><p className="eyebrow">DENSIDADE TERRITORIAL</p><h2>{mapMode === "heatmap" ? "Heatmap de concentração" : "Sites por GEO SCORE"}</h2></div><span>{data?.points.length || 0} pontos na amostra visual</span></div><MapView points={data?.points || []} mode={mapMode} onSelect={onSelectSite} />{mapMode === "heatmap" && <div className="heat-legend"><span>Menor concentração</span><i /><span>Maior concentração</span></div>}</section>

    <div className="method-note"><strong>Metodologia V1.3</strong><span>ORI: 40% GEO SCORE + 20% status + 20% altura + 20% tipo de infraestrutura. TCI: 30% população coberta + 30% sites únicos + 20% tecnologias + 20% cobertura territorial, normalizados entre as operadoras da seleção.</span></div>
  </div>;
}
