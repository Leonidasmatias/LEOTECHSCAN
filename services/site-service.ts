import { text } from "@/lib/db";

export function siteRow(raw: Record<string, unknown>) {
  return {
    id: Number(raw.id),
    siteId: text(raw.site_id ?? raw.site),
    site: text(raw.site ?? raw.site_id),
    operadoraOrigem: text(raw.operadora_origem ?? raw.operadora_classificada),
    elemento: text(raw.tipo_elemento ?? raw.tipo_site),
    tecnologia: text(raw.tecnologia),
    municipio: text(raw.municipio),
    estado: text(raw.estado ?? raw.uf),
    uf: text(raw.uf ?? raw.estado),
    regional: text(raw.regional),
    endereco: text(raw.endereco),
    status: text(raw.status_normalizado ?? raw.status),
    projeto: text(raw.projeto),
    tipoSite: text(raw.tipo_site ?? raw.tipo_elemento),
    detentorInfra: text(raw.detentor_infra),
    tipoInfra: text(raw.tipo_infra),
    latitude: Number(raw.latitude),
    longitude: Number(raw.longitude),
    populacao: Number(raw.populacao || 0),
    altura: Number(raw.altura || 0),
    geoScore: Number(raw.geo_score),
    risco: text(raw.risco),
    stationId: text(raw.station_id),
    operadora: text(raw.operadora_classificada ?? raw.operadora_origem),
    oriScore: Number(raw.ori_score || 0),
    oriRisk: text(raw.ori_risk),
    dataImportacao: text(raw.data_importacao),
    arquivoOrigem: text(raw.arquivo_origem),
  };
}
