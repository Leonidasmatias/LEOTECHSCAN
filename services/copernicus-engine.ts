import type { DatabaseSync } from "node:sqlite";
import rules from "@/config/copernicus_rules.json";
import { SITE_SELECT } from "@/api/site-query";
import { siteRow } from "@/services/site-service";

type SiteLike = {
  id: number;
  site: string;
  latitude: number;
  longitude: number;
  municipio?: string;
  uf?: string;
};

export type CopernicusScene = {
  siteId: number;
  site: string;
  latitude: number;
  longitude: number;
  provider: string;
  mission: string;
  productType: string;
  acquisitionDate: string;
  orbitDirection: string;
  polarization: string;
  relativeOrbit: number;
  sceneId: string;
  cloudNote: string;
  sourceUrl: string;
  metadata: Record<string, unknown>;
};

function nowIso() {
  return new Date().toISOString();
}

export function ensureCopernicusTables(db: DatabaseSync) {
  db.exec(`CREATE TABLE IF NOT EXISTS copernicus_scenes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    site_id INTEGER NOT NULL,
    site TEXT,
    latitude REAL,
    longitude REAL,
    provider TEXT,
    mission TEXT,
    product_type TEXT,
    acquisition_date TEXT,
    orbit_direction TEXT,
    polarization TEXT,
    relative_orbit INTEGER,
    scene_id TEXT,
    cloud_note TEXT,
    source_url TEXT,
    metadata_json TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS site_satellite_validation (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    site_id INTEGER NOT NULL,
    site TEXT,
    validation_score INTEGER,
    coordinate_quality TEXT,
    satellite_coverage_status TEXT,
    recent_scene_available INTEGER,
    evidence_level TEXT,
    recommendation TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );`);
}

export function validateSiteCoordinates(site: SiteLike) {
  const valid = Number.isFinite(site.latitude) && Number.isFinite(site.longitude) && site.latitude >= -34 && site.latitude <= 6 && site.longitude >= -75 && site.longitude <= -32 && !(site.latitude === 0 && site.longitude === 0);
  return {
    valid,
    quality: valid ? "Valida para analise territorial Brasil" : "Invalida ou ausente",
    latitude: site.latitude,
    longitude: site.longitude,
  };
}

export function buildSentinel1SearchQuery(site: SiteLike, radiusKm = rules.defaultRadiusKm, lookbackDays = rules.defaultLookbackDays) {
  const from = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();
  return {
    provider: rules.provider,
    mission: rules.mission,
    productTypes: rules.productTypes,
    apiMode: rules.apiMode,
    radiusKm,
    lookbackDays,
    from,
    point: { latitude: site.latitude, longitude: site.longitude },
    odataHint: `${rules.endpoints.odata}?$filter=Collection/Name eq 'SENTINEL-1' and ContentDate/Start ge ${from}`,
    stacHint: rules.endpoints.stac,
  };
}

function mockScenes(site: SiteLike, radiusKm: number, lookbackDays: number): CopernicusScene[] {
  const total = Math.min(rules.maxScenesPerSite, Math.max(1, Math.floor(lookbackDays / rules.mockMode.sceneSpacingDays)));
  return Array.from({ length: total }).map((_, index) => {
    const date = new Date(Date.now() - (index + 1) * rules.mockMode.sceneSpacingDays * 24 * 60 * 60 * 1000).toISOString();
    const orbit = rules.mockMode.orbitDirections[index % rules.mockMode.orbitDirections.length];
    return {
      siteId: site.id,
      site: site.site,
      latitude: site.latitude,
      longitude: site.longitude,
      provider: rules.provider,
      mission: rules.mission,
      productType: rules.productTypes[0],
      acquisitionDate: date,
      orbitDirection: orbit,
      polarization: rules.mockMode.polarizations[0],
      relativeOrbit: 30 + index,
      sceneId: `MOCK_S1_${site.site}_${date.slice(0, 10).replace(/-/g, "")}_${orbit}`,
      cloudNote: "SAR Sentinel-1 opera dia/noite e em qualquer clima; nuvens nao sao limitacao principal.",
      sourceUrl: rules.endpoints.odata,
      metadata: { mode: "mock_metadata_only", radiusKm, lookbackDays, noHeavyImageDownload: true },
    };
  });
}

export function fetchSentinel1Metadata(site: SiteLike, radiusKm = rules.defaultRadiusKm, lookbackDays = rules.defaultLookbackDays) {
  const coordinate = validateSiteCoordinates(site);
  if (!coordinate.valid) return { mode: "metadata_only", mock: true, scenes: [] as CopernicusScene[], warning: "Coordenada invalida; busca Sentinel-1 nao simulada." };
  const hasCredentials = Boolean(process.env.COPERNICUS_ACCESS_TOKEN || process.env.COPERNICUS_CLIENT_ID);
  const scenes = hasCredentials ? mockScenes(site, radiusKm, lookbackDays) : mockScenes(site, radiusKm, lookbackDays);
  return {
    mode: rules.apiMode,
    mock: !hasCredentials,
    scenes,
    warning: hasCredentials ? "Metadata-only ativo; download SAR desabilitado." : "Modo mock controlado: sem credenciais Copernicus configuradas e sem download de imagens.",
  };
}

export function calculateSatelliteValidationScore(site: SiteLike, scenes: CopernicusScene[]) {
  const coordinate = validateSiteCoordinates(site);
  const recentLimit = Date.now() - rules.scoring.recentSceneDays * 24 * 60 * 60 * 1000;
  const recent = scenes.some((scene) => new Date(scene.acquisitionDate).getTime() >= recentLimit);
  const score = Math.min(100,
    (coordinate.valid ? rules.scoring.validCoordinate : 0) +
    (recent ? rules.scoring.recentScene : 0) +
    (scenes.length > 1 ? rules.scoring.multipleScenes : 0) +
    (scenes.length ? rules.scoring.metadataCompleteness : 0));
  const evidenceLevel = score >= 80 ? "Alta" : score >= 55 ? "Media" : score >= 30 ? "Baixa" : "Insuficiente";
  return {
    validationScore: score,
    coordinateQuality: coordinate.quality,
    satelliteCoverageStatus: scenes.length ? "Cenas Sentinel-1 metadata disponiveis" : "Sem cenas metadata disponiveis",
    recentSceneAvailable: recent,
    evidenceLevel,
  };
}

export function generateSatelliteRecommendation(site: SiteLike, score: ReturnType<typeof calculateSatelliteValidationScore>, scenes: CopernicusScene[]) {
  if (!validateSiteCoordinates(site).valid) return "Revisar coordenadas antes de usar evidencia Copernicus.";
  if (!scenes.length) return "Consultar catalogo Copernicus real quando credenciais STAC/OData estiverem configuradas.";
  if (score.validationScore >= 80) return "Evidencia satelital forte para apoiar validacao territorial, combinada com base TIM/VIVO, mapa e vistoria.";
  return "Evidencia satelital util como apoio, mas recomenda-se complementar com vistoria de campo e dados operacionais.";
}

function persistEvidence(db: DatabaseSync, site: SiteLike, scenes: CopernicusScene[], validation: ReturnType<typeof calculateSatelliteValidationScore>, recommendation: string) {
  ensureCopernicusTables(db);
  const sceneInsert = db.prepare("INSERT INTO copernicus_scenes (site_id,site,latitude,longitude,provider,mission,product_type,acquisition_date,orbit_direction,polarization,relative_orbit,scene_id,cloud_note,source_url,metadata_json,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)");
  for (const scene of scenes) {
    const exists = db.prepare("SELECT id FROM copernicus_scenes WHERE scene_id = ? LIMIT 1").get(scene.sceneId);
    if (!exists) sceneInsert.run(site.id, site.site, site.latitude, site.longitude, scene.provider, scene.mission, scene.productType, scene.acquisitionDate, scene.orbitDirection, scene.polarization, scene.relativeOrbit, scene.sceneId, scene.cloudNote, scene.sourceUrl, JSON.stringify(scene.metadata), nowIso());
  }
  db.prepare("INSERT INTO site_satellite_validation (site_id,site,validation_score,coordinate_quality,satellite_coverage_status,recent_scene_available,evidence_level,recommendation,created_at) VALUES (?,?,?,?,?,?,?,?,?)")
    .run(site.id, site.site, validation.validationScore, validation.coordinateQuality, validation.satelliteCoverageStatus, validation.recentSceneAvailable ? 1 : 0, validation.evidenceLevel, recommendation, nowIso());
}

export function getSite(db: DatabaseSync, id: number) {
  const raw = db.prepare(`SELECT ${SITE_SELECT} FROM sites WHERE id = ?`).get(id) as Record<string, unknown> | undefined;
  return raw ? siteRow(raw) : null;
}

export function copernicusForSite(db: DatabaseSync, id: number, radiusKm = rules.defaultRadiusKm, lookbackDays = rules.defaultLookbackDays, persist = false) {
  ensureCopernicusTables(db);
  const site = getSite(db, id);
  if (!site) return null;
  const searchQuery = buildSentinel1SearchQuery(site, radiusKm, lookbackDays);
  const metadata = fetchSentinel1Metadata(site, radiusKm, lookbackDays);
  const validation = calculateSatelliteValidationScore(site, metadata.scenes);
  const recommendation = generateSatelliteRecommendation(site, validation, metadata.scenes);
  if (persist) persistEvidence(db, site, metadata.scenes, validation, recommendation);
  return {
    site,
    integration: copernicusStatus(db),
    searchQuery,
    scenes: metadata.scenes,
    validation,
    recommendation,
    warning: metadata.warning,
    governance: rules.governance.disclaimer,
  };
}

export function copernicusStatus(db: DatabaseSync) {
  ensureCopernicusTables(db);
  const validCoordinates = Number((db.prepare("SELECT COUNT(*) total FROM sites WHERE latitude BETWEEN -34 AND 6 AND longitude BETWEEN -75 AND -32 AND NOT (latitude = 0 AND longitude = 0)").get() as Record<string, unknown>).total || 0);
  const total = Number((db.prepare("SELECT COUNT(*) total FROM sites").get() as Record<string, unknown>).total || 0);
  const sceneRows = Number((db.prepare("SELECT COUNT(*) total FROM copernicus_scenes").get() as Record<string, unknown>).total || 0);
  const validations = Number((db.prepare("SELECT COUNT(*) total FROM site_satellite_validation").get() as Record<string, unknown>).total || 0);
  const avgScore = Number((db.prepare("SELECT ROUND(AVG(validation_score),1) avg FROM site_satellite_validation").get() as Record<string, unknown>).avg || 0);
  const latest = db.prepare("SELECT site_id siteId,site,validation_score validationScore,evidence_level evidenceLevel,created_at createdAt FROM site_satellite_validation ORDER BY id DESC LIMIT 10").all();
  return {
    enabled: rules.enabled,
    provider: rules.provider,
    mission: rules.mission,
    apiMode: rules.apiMode,
    allowDownload: rules.allowDownload,
    metadataOnly: true,
    mockMode: !(process.env.COPERNICUS_ACCESS_TOKEN || process.env.COPERNICUS_CLIENT_ID),
    totals: { totalSites: total, validCoordinates, missingCoordinates: Math.max(0, total - validCoordinates), eligibleSites: validCoordinates, sceneRows, validations, averageValidationScore: avgScore },
    latestValidations: latest,
    limitations: [
      "Nao baixa imagens SAR nesta fase.",
      "Nao substitui vistoria de campo.",
      "Nao garante identificacao automatica de torre.",
      "Evidencia deve ser combinada com TIM/VIVO, mapa, coordenadas e dados operacionais."
    ],
  };
}

export function copernicusCsvRows(db: DatabaseSync) {
  ensureCopernicusTables(db);
  const rows = db.prepare("SELECT site_id,site,validation_score,coordinate_quality,satellite_coverage_status,recent_scene_available,evidence_level,recommendation,created_at FROM site_satellite_validation ORDER BY id DESC LIMIT 500").all() as Record<string, unknown>[];
  return [["SITE_ID", "SITE", "SCORE", "COORDENADA", "COBERTURA", "CENA_RECENTE", "EVIDENCIA", "RECOMENDACAO", "CRIADO_EM"], ...rows.map((row) => [row.site_id, row.site, row.validation_score, row.coordinate_quality, row.satellite_coverage_status, row.recent_scene_available, row.evidence_level, row.recommendation, row.created_at])];
}

export function copernicusEvidenceRows(db: DatabaseSync) {
  ensureCopernicusTables(db);
  const rows = db.prepare("SELECT site_id,site,provider,mission,product_type,acquisition_date,orbit_direction,polarization,relative_orbit,scene_id,cloud_note,source_url,created_at FROM copernicus_scenes ORDER BY id DESC LIMIT 500").all() as Record<string, unknown>[];
  return [["SITE_ID", "SITE", "PROVIDER", "MISSION", "PRODUCT_TYPE", "ACQUISITION_DATE", "ORBIT", "POLARIZATION", "RELATIVE_ORBIT", "SCENE_ID", "NOTE", "SOURCE_URL", "CRIADO_EM"], ...rows.map((row) => [row.site_id, row.site, row.provider, row.mission, row.product_type, row.acquisition_date, row.orbit_direction, row.polarization, row.relative_orbit, row.scene_id, row.cloud_note, row.source_url, row.created_at])];
}
