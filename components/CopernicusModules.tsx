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
      if (!response.ok) throw new Error(body.error || "Falha Copernicus");
      if (active) setData(body);
    }).catch((err) => active && setError(err instanceof Error ? err.message : "Falha Copernicus"));
    return () => { active = false; };
  }, [url]);
  return { data, error };
}

export function SatelliteIntelligenceView() {
  const { data, error } = useApi<any>("/api/copernicus/status");
  return <section className="s2b-view">
    <div className="s2b-hero panel"><div><p className="eyebrow">COPERNICUS / SENTINEL-1</p><h2>Satellite Intelligence <CapabilityBadge capabilityKey="copernicus_catalogue" /></h2><p>Camada metadata-only para validacao territorial dos sites. Sem download de imagens SAR nesta fase.</p><CapabilityNote capabilityKey="copernicus_catalogue" /></div><a href="/api/executive-reports?type=copernicus-site-validation&format=csv">Exportar Relatorio</a></div>
    {error ? <p className="error">{error}</p> : null}
    <div className="s2b-kpis">
      <article className="panel"><span>Sites com coordenadas validas</span><strong>{nf.format(data?.totals?.validCoordinates || 0)}</strong></article>
      <article className="panel danger"><span>Sem coordenadas validas</span><strong>{nf.format(data?.totals?.missingCoordinates || 0)}</strong></article>
      <article className="panel"><span>Elegiveis</span><strong>{nf.format(data?.totals?.eligibleSites || 0)}</strong></article>
      <article className="panel"><span>Score medio</span><strong>{data?.totals?.averageValidationScore || 0}</strong></article>
    </div>
    <div className="copernicus-grid">
      <article className="panel"><span>Status</span><strong>{data?.enabled ? "Ativo" : "Inativo"}</strong><small>{data?.provider} · {data?.mission} · {data?.apiMode}</small><small>{data?.isRealSatelliteEvidence ? "Evidencia satelital real" : "100% simulado — nenhuma chamada real ao Copernicus existe nesta versao"}</small></article>
      <article className="panel"><span>Cenas registradas</span><strong>{nf.format(data?.totals?.sceneRows || 0)}</strong><small>Metadados persistidos em SQLite</small></article>
      <article className="panel"><span>Validacoes</span><strong>{nf.format(data?.totals?.validations || 0)}</strong><small>site_satellite_validation</small></article>
    </div>
    <section className="panel copernicus-limitations">
      <p className="eyebrow">GOVERNANCA</p>
      {(data?.limitations || []).map((item: string) => <p key={item}>{item}</p>)}
      {/* WP0.12: Sentinel-1 processing and change-detection are not implemented anywhere in this
          UI. Rather than let their absence go unstated, they are named here explicitly as
          unavailable, next to the registry's truth about them. */}
      <p><CapabilityBadge capabilityKey="sentinel_1_processing" /> Processamento SAR (Sentinel-1)</p>
      <CapabilityNote capabilityKey="sentinel_1_processing" />
      <p><CapabilityBadge capabilityKey="sentinel_1_change_detection" /> Deteccao de mudanca (Sentinel-1)</p>
      <CapabilityNote capabilityKey="sentinel_1_change_detection" />
    </section>
    <div className="s2b-rows">{(data?.latestValidations || []).map((row: any) => <div key={`${row.siteId}-${row.createdAt}`}><span><small>site</small><strong>{row.site}</strong></span><span><small>score</small><strong>{row.validationScore}</strong></span><span><small>evidencia</small><strong>{row.evidenceLevel}</strong></span><span><small>data</small><strong>{row.createdAt}</strong></span></div>)}</div>
  </section>;
}

export function CopernicusSiteEvidence({ siteId }: { siteId: number }) {
  const [loaded, setLoaded] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const consult = async () => {
    setError("");
    const response = await fetch(`/api/copernicus/validation?id=${siteId}`);
    const body = await response.json();
    if (!response.ok) setError(body.error || "Falha Copernicus");
    else {
      setData(body);
      setLoaded(true);
    }
  };
  useEffect(() => { fetch(`/api/copernicus/site?id=${siteId}`).then((r) => r.json()).then(setData).catch(() => undefined); }, [siteId]);
  const validation = data?.validation;
  const scene = data?.recentScene || data?.scenes?.[0];
  return <section className="site-copernicus"><h3>Copernicus / Sentinel-1 Validation <CapabilityBadge capabilityKey="sentinel_1_metadata" /></h3>
    <CapabilityNote capabilityKey="sentinel_1_metadata" />
    {error ? <p className="error">{error}</p> : null}
    <div className="site-panel-grid"><span>Coordenada<strong>{validation?.coordinateQuality || "Carregando"}</strong></span><span>Cenas S1<strong>{validation?.satelliteCoverageStatus || "-"}</strong></span><span>Cena recente<strong>{validation?.recentSceneAvailable ? "Sim" : "Nao"}</strong></span><span>Score satelital<strong>{validation?.validationScore ?? "-"}</strong></span><span>Evidencia<strong>{validation?.evidenceLevel || "-"}</strong></span><span>Raio<strong>{data?.searchQuery?.radiusKm || 2} km</strong></span></div>
    <p>{data?.recommendation || "Validacao metadata-only baseada em coordenadas e disponibilidade simulada/controlada de cenas Sentinel-1."}</p>
    <small>{data?.warning || "Sem download de imagens SAR."}</small>
    {scene ? <small>Cena mais recente: {scene.acquisitionDate} · {scene.orbitDirection} · {scene.polarization}</small> : null}
    <div className="site-actions"><button type="button" onClick={consult}>{loaded ? "Consultar novamente" : "Consultar Copernicus"}</button><a href={`/api/export?type=copernicus-evidence&id=${siteId}`}>Exportar evidencia</a></div>
  </section>;
}
