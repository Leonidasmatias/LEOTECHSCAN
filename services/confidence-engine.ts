import type { DatabaseSync } from "node:sqlite";
import { satelliteValidationForSite } from "@/services/satellite-validation-engine";

type SiteTrustInput = {
  id: number;
  site: string;
  operadoraOrigem: string;
  municipio: string;
  uf: string;
  endereco: string;
  tecnologia: string;
  latitude: number;
  longitude: number;
  dataImportacao: string;
  arquivoOrigem: string;
  status: string;
  geoScore: number;
};

function filled(value: unknown) {
  const text = String(value ?? "").trim();
  return Boolean(text && text !== "Nao informado" && text !== "NÃ£o informado");
}

function validCoordinate(site: SiteTrustInput) {
  return Number.isFinite(site.latitude) && Number.isFinite(site.longitude) && site.latitude >= -34 && site.latitude <= 6 && site.longitude >= -75 && site.longitude <= -32 && !(site.latitude === 0 && site.longitude === 0);
}

export function confidenceForSite(db: DatabaseSync, site: SiteTrustInput) {
  const satellite = satelliteValidationForSite(db, site.id);
  const coordinateConfidence = validCoordinate(site) ? 100 : 0;
  const addressConfidence = filled(site.endereco) ? 90 : 15;
  const municipalityConfidence = filled(site.municipio) && filled(site.uf) ? 95 : filled(site.municipio) || filled(site.uf) ? 45 : 10;
  const operatorConfidence = filled(site.operadoraOrigem) ? 95 : 20;
  const technologyConfidence = filled(site.tecnologia) ? 90 : 20;
  const satelliteConfidence = satellite.satelliteValidationScore;
  const cadastralConfidence = Math.round((addressConfidence + municipalityConfidence + operatorConfidence + technologyConfidence) / 4);
  const operationalConfidence = filled(site.status) ? Math.max(20, Math.min(100, 100 - Number(site.geoScore || 0) / 2)) : 35;
  const overallConfidence = Math.round(coordinateConfidence * 0.2 + addressConfidence * 0.12 + municipalityConfidence * 0.12 + operatorConfidence * 0.1 + technologyConfidence * 0.1 + satelliteConfidence * 0.16 + cadastralConfidence * 0.1 + operationalConfidence * 0.1);
  return {
    coordinateConfidence,
    addressConfidence,
    municipalityConfidence,
    operatorConfidence,
    technologyConfidence,
    satelliteConfidence,
    cadastralConfidence,
    operationalConfidence,
    overallConfidence,
    satellite,
  };
}
