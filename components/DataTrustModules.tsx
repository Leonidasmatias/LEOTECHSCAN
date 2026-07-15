"use client";

import { useEffect, useState } from "react";
import { CapabilityBadge, CapabilityNote } from "@/components/CapabilityBadge";

const nf = new Intl.NumberFormat("pt-BR");

function useApi<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    fetch(url).then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Falha Data Trust");
      if (active) setData(body);
    }).catch((err) => active && setError(err instanceof Error ? err.message : "Falha Data Trust"));
    return () => { active = false; };
  }, [url]);
  return { data, error };
}

export function DataTrustView() {
  const { data, error } = useApi<any>("/api/data-trust");
  const recalc = async () => {
    await fetch("/api/data-trust/recalculate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ limit: 500 }) });
    window.location.reload();
  };
  return <section className="s2b-view">
    <div className="s2b-hero panel"><div><p className="eyebrow">DATA TRUST ENGINE</p><h2>Confianca e Evidencias <CapabilityBadge capabilityKey="data_trust" /></h2><p>Score tecnico auditavel por site, com historico, evidencias e governanca.</p><CapabilityNote capabilityKey="data_trust" /></div><a href="/api/export?type=data-trust-scores">Exportar CSV</a></div>
    {error ? <p className="error">{error}</p> : null}
    <div className="s2b-kpis">
      <article className="panel"><span>Trust medio</span><strong>{data?.summary?.averageTrust || 0}</strong></article>
      <article className="panel"><span>Platinum</span><strong>{nf.format(data?.summary?.platinum || 0)}</strong></article>
      <article className="panel"><span>Gold</span><strong>{nf.format(data?.summary?.gold || 0)}</strong></article>
      <article className="panel danger"><span>Critical</span><strong>{nf.format(data?.summary?.critical || 0)}</strong></article>
    </div>
    <div className="s2b-kpis">
      <article className="panel"><span>Silver</span><strong>{nf.format(data?.summary?.silver || 0)}</strong></article>
      <article className="panel"><span>Bronze</span><strong>{nf.format(data?.summary?.bronze || 0)}</strong></article>
      <article className="panel danger"><span>Sem coordenadas validas</span><strong>{nf.format(data?.summary?.criticalMissingCoordinates || 0)}</strong></article>
      <article className="panel"><span>Sites pontuados</span><strong>{nf.format(data?.summary?.scoredSites || 0)}</strong></article>
    </div>
    <div className="s4-form panel"><button onClick={recalc}>Recalcular amostra 500</button><a className="export-button" href="/api/export?type=site-validation-history">Historico CSV</a><a className="export-button" href="/api/export?type=audit-trail">Audit Trail CSV</a></div>
    <div className="s2b-rows">{(data?.ranking || []).slice(0, 30).map((row: any) => <div key={`${row.siteId}-${row.updatedAt}`}><span><small>site</small><strong>{row.site}</strong></span><span><small>score</small><strong>{row.trustScore}</strong></span><span><small>level</small><strong>{row.trustLevel}</strong></span><span><small>badge</small><strong>{row.trustBadge}</strong></span></div>)}</div>
    <section className="panel copernicus-limitations"><p className="eyebrow">GOVERNANCA</p><p>{data?.governance}</p></section>
  </section>;
}

export function SiteTrustPanel({ siteId }: { siteId: number }) {
  const { data } = useApi<any>(`/api/data-trust/site?id=${siteId}`);
  return <section className="site-copernicus"><h3>Data Trust & Confidence <CapabilityBadge capabilityKey="data_trust" /></h3>
    <div className="site-panel-grid"><span>Trust Score<strong>{data?.trustScore ?? "-"}</strong></span><span>Level<strong>{data?.trustLevel || "-"}</strong></span><span>Badge<strong>{data?.trustBadge || "-"}</strong></span><span>Satélite<strong>{data?.satelliteConfidence ?? "-"}</strong></span><span>Cadastro<strong>{data?.cadastralConfidence ?? "-"}</strong></span><span>Operacional<strong>{data?.operationalConfidence ?? "-"}</strong></span></div>
    <p>{data?.recommendation || "Trust Score e uma estimativa tecnica baseada nos dados disponiveis."}</p>
    <div className="site-actions"><a href={`/api/evidence-center/export?id=${siteId}&format=pdf`}>Gerar Dossie Tecnico</a><a href={`/api/evidence-center/export?id=${siteId}&format=csv`}>Exportar CSV</a></div>
  </section>;
}

export function EvidenceCenterPanel({ siteId }: { siteId: number }) {
  const { data } = useApi<any>(`/api/evidence-center/site?id=${siteId}`);
  return <section className="site-copernicus"><h3>Telecom Evidence Center <CapabilityBadge capabilityKey="evidence_center" /></h3>
    <CapabilityNote capabilityKey="evidence_center" />
    <div className="s2b-rows">{(data?.evidences || []).map((row: any) => <div key={`${row.type}-${row.source}`}><span><small>tipo</small><strong>{row.type}</strong></span><span><small>fonte</small><strong>{row.source}</strong></span><span><small>status</small><strong>{row.status}</strong></span><span><small>resumo</small><strong>{row.summary}</strong></span></div>)}</div>
    <p>{data?.governance || "Dossie tecnico de apoio, nao substitui vistoria de campo."}</p>
  </section>;
}
