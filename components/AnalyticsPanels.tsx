import type { AverageRank, SiteRow, VolumeRank } from "@/lib/types";

const nf = new Intl.NumberFormat("pt-BR");

export function VolumeRanking({ title, eyebrow, data }: { title: string; eyebrow: string; data: VolumeRank[] }) {
  const max = data[0]?.records || 1;
  return <section className="panel analytics-panel">
    <div className="panel-head"><div><p className="eyebrow">{eyebrow}</p><h3>{title}</h3></div><span>REGISTROS / SITES</span></div>
    <div className="bar-list">{data.map((item, index) => <div className="bar-item" key={item.label}>
      <b>{String(index + 1).padStart(2, "0")}</b><div><span>{item.label}</span><i><em style={{ width: `${Math.max(3, item.records / max * 100)}%` }} /></i></div><strong>{nf.format(item.records)}<small>{nf.format(item.sites)} sites</small></strong>
    </div>)}</div>
  </section>;
}

export function AverageRanking({ title, eyebrow, data }: { title: string; eyebrow: string; data: AverageRank[] }) {
  const max = data[0]?.average || 1;
  return <section className="panel analytics-panel">
    <div className="panel-head"><div><p className="eyebrow">{eyebrow}</p><h3>{title}</h3></div><span>METROS</span></div>
    <div className="bar-list compact">{data.map((item, index) => <div className="bar-item" key={item.label}>
      <b>{String(index + 1).padStart(2, "0")}</b><div><span>{item.label}</span><i><em className="violet" style={{ width: `${Math.max(3, item.average / max * 100)}%` }} /></i></div><strong>{item.average.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} m<small>{nf.format(item.samples)} amostras</small></strong>
    </div>)}</div>
  </section>;
}

export function TallestStructures({ data }: { data: SiteRow[] }) {
  return <section className="panel table-panel tallest-panel">
    <div className="panel-head"><div><p className="eyebrow">ALTURA DA ESTRUTURA</p><h3>20 maiores estruturas</h3></div><span>RANKING NACIONAL FILTRADO</span></div>
    <div className="table-scroll"><table><thead><tr><th>#</th><th>Site</th><th>Localidade</th><th>Detentor</th><th>Tipo de infra</th><th>Altura</th><th>GEO SCORE</th></tr></thead><tbody>{data.map((site, index) => <tr key={site.id}><td className="rank-number">{String(index + 1).padStart(2, "0")}</td><td><strong>{site.siteId}</strong><small>{site.tecnologia}</small></td><td>{site.municipio}<small>{site.estado}</small></td><td>{site.detentorInfra}</td><td>{site.tipoInfra}</td><td className="height-value">{site.altura.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} m</td><td><span className={`badge ${site.risco.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()}`}>{site.geoScore} · {site.risco}</span></td></tr>)}</tbody></table></div>
  </section>;
}
