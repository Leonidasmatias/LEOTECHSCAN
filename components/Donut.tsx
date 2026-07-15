import type { Breakdown } from "@/lib/types";

const palette = ["#45d6c4", "#6c7cff", "#f5c451", "#ff7e67", "#a36dff", "#39a9ff"];

export default function Donut({ title, data }: { title: string; data: Breakdown[] }) {
  const top = data.slice(0, 6); const total = top.reduce((sum, item) => sum + item.value, 0) || 1;
  let cursor = 0;
  const stops = top.map((item, index) => { const start = cursor; cursor += item.value / total * 100; return `${palette[index]} ${start}% ${cursor}%`; }).join(",");
  return <section className="panel chart-panel"><div className="panel-head"><h3>{title}</h3><span>Top {top.length}</span></div><div className="donut-wrap"><div className="donut" style={{ background: `conic-gradient(${stops})` }}><div><strong>{new Intl.NumberFormat("pt-BR", { notation: "compact" }).format(total)}</strong><small>registros</small></div></div><div className="legend">{top.map((item, index) => <div key={item.label}><i style={{ background: palette[index] }} /><span title={item.label}>{item.label}</span><b>{new Intl.NumberFormat("pt-BR", { notation: "compact" }).format(item.value)}</b></div>)}</div></div></section>;
}
