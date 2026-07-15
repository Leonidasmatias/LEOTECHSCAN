"use client";

import { useEffect, useState } from "react";

const nf = new Intl.NumberFormat("pt-BR");

function useApi<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(url).then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Falha na API");
      if (active) setData(body);
    }).catch((err) => active && setError(err instanceof Error ? err.message : "Falha na API")).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [url]);
  return { data, loading, error };
}

export function DataQualityView() {
  const { data, loading, error } = useApi<any>("/api/data-quality");
  return <section className="s3-shell">
    <div className="s3-head"><div><p className="eyebrow">SPRINT 3 ENTERPRISE</p><h2>Qualidade Cadastral</h2><span>Completude, coordenadas, endereco, municipio, UF e tecnologia.</span></div><a href="/api/export?type=qualidade-cadastral">Exportar CSV</a></div>
    {error ? <div className="error">{error}</div> : null}
    <div className="s3-kpis"><article><span>Score cadastral</span><strong>{data?.summary?.qualityScore ?? "-"}%</strong></article><article><span>Tipos com falha</span><strong>{nf.format(data?.summary?.issueTypes || 0)}</strong></article><article><span>Ocorrencias</span><strong>{nf.format(data?.summary?.totalIssues || 0)}</strong></article><article><span>Registros</span><strong>{nf.format(data?.summary?.totalRecords || 0)}</strong></article></div>
    {loading ? <p className="s3-loading">Carregando qualidade cadastral...</p> : <div className="s3-table"><table><thead><tr><th>Severidade</th><th>Categoria</th><th>Problema</th><th>Total</th></tr></thead><tbody>{(data?.issues || []).map((item: any) => <tr key={item.id}><td><span className={`s3-badge ${item.severity}`}>{item.severity}</span></td><td>{item.category}</td><td>{item.label}</td><td>{nf.format(item.total)}</td></tr>)}</tbody></table></div>}
  </section>;
}

export function DuplicatesView() {
  const { data, loading, error } = useApi<any>("/api/duplicates");
  return <section className="s3-shell">
    <div className="s3-head"><div><p className="eyebrow">DEDUPLICACAO SUGESTIVA</p><h2>Possiveis Duplicidades</h2><span>Nenhum registro e excluido; os grupos abaixo sao apenas candidatos para auditoria.</span></div><a href="/api/export?type=possiveis-duplicidades">Exportar CSV</a></div>
    {error ? <div className="error">{error}</div> : null}
    <div className="s3-kpis"><article><span>Candidatos</span><strong>{nf.format(data?.summary?.totalCandidates || 0)}</strong></article><article><span>Alta</span><strong>{nf.format(data?.summary?.high || 0)}</strong></article><article><span>Media</span><strong>{nf.format(data?.summary?.medium || 0)}</strong></article><article><span>Baixa</span><strong>{nf.format(data?.summary?.low || 0)}</strong></article></div>
    {loading ? <p className="s3-loading">Analisando duplicidades...</p> : <div className="s3-list">{(data?.candidates || []).slice(0, 60).map((item: any) => <article key={`${item.type}-${item.key}`}><div><strong>{item.key}</strong><span>{item.type} · {item.total} registros</span></div><p>{item.recommendation}</p><small>{(item.sample || []).slice(0, 3).map((site: any) => site.site).join(", ")}</small></article>)}</div>}
  </section>;
}

export function NationalTimelineView() {
  const { data, loading, error } = useApi<any>("/api/national-timeline");
  return <section className="s3-shell">
    <div className="s3-head"><div><p className="eyebrow">TIMELINE NACIONAL</p><h2>Evolucao da Base Consolidada</h2><span>Importacoes, totais por operadora e municipios monitorados.</span></div><a href="/api/export?type=timeline-nacional">Exportar CSV</a></div>
    {error ? <div className="error">{error}</div> : null}
    <div className="s3-kpis"><article><span>TIM</span><strong>{nf.format(data?.summary?.totalTim || 0)}</strong></article><article><span>VIVO</span><strong>{nf.format(data?.summary?.totalVivo || 0)}</strong></article><article><span>Municipios</span><strong>{nf.format(data?.summary?.monitoredMunicipalities || 0)}</strong></article><article><span>Ultima importacao</span><strong>{data?.summary?.lastImport || "-"}</strong></article></div>
    {loading ? <p className="s3-loading">Carregando timeline...</p> : <div className="s3-table"><table><thead><tr><th>Operadora</th><th>Registros</th><th>Sites</th><th>Municipios</th><th>Ultima importacao</th></tr></thead><tbody>{(data?.byOperator || []).map((item: any) => <tr key={item.operator}><td>{item.operator}</td><td>{nf.format(item.records)}</td><td>{nf.format(item.sites)}</td><td>{nf.format(item.municipalities)}</td><td>{item.lastImport}</td></tr>)}</tbody></table></div>}
  </section>;
}
