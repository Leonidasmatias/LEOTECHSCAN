export type SiteRow = {
  id: number;
  siteId: string;
  site: string;
  operadoraOrigem: string;
  elemento: string;
  tecnologia: string;
  municipio: string;
  estado: string;
  uf: string;
  regional: string;
  endereco: string;
  status: string;
  projeto: string;
  tipoSite: string;
  detentorInfra: string;
  tipoInfra: string;
  latitude: number;
  longitude: number;
  populacao: number;
  altura: number;
  geoScore: number;
  risco: string;
  stationId: string;
  operadora: string;
  oriScore: number;
  oriRisk: string;
  dataImportacao: string;
  arquivoOrigem: string;
};

export type Breakdown = { label: string; value: number };
export type VolumeRank = { label: string; records: number; sites: number };
export type AverageRank = { label: string; average: number; samples: number };
export type OperatorMetric = { operator: string; records: number; sites: number; states: number; municipalities: number; technologies: number; averageHeight: number; averageGeo: number; averageOri: number; population: number; tci: number };
export type StrategicScore = { score: number; level: string; stars: number; starsText?: string; color: string };
export type StrategicMunicipality = {
  municipio: string;
  uf: string;
  records: number;
  sites: number;
  operators: number;
  technologies: number;
  population: number;
  avgGeo: number;
  lts: StrategicScore;
  tci: number;
  opi: number;
  sri: StrategicScore;
};
export type MissionControlData = {
  status: { database: string; api: string; apiMs: number };
  kpis: { totalSites: number; totalOperators: number; totalMunicipalities: number; totalStates: number; totalRecords: number; lastImport: string; alerts: number; avgLts: number };
  cards: { coverage: number; growth: number; topMunicipality: StrategicMunicipality | null };
  rankings: { national: StrategicMunicipality[]; state: StrategicMunicipality[]; topMunicipalities: StrategicMunicipality[]; opi: StrategicMunicipality[]; sri: StrategicMunicipality[] };
  distributions: { byUf: Array<{ label: string; records: number; sites: number }>; operators: Array<Record<string, unknown>> };
  imports: Array<Record<string, unknown>>;
};
export type SiteIntelligenceData = {
  scores: { lts: StrategicScore; ori: number; tci: number; opi: number; sri: StrategicScore };
  municipality: { records: number; sites: number; operators: number; technologies: number; population: number; avgGeo: number };
  operatorRanks: Array<Record<string, unknown>>;
  nearby: Array<SiteRow & { distanceKm: number }>;
  timeline: Array<{ type: string; label: string; date: string; detail: string }>;
  imports: Array<Record<string, unknown>>;
  observations: string[];
};

export type DashboardData = {
  summary: { total: number; uniqueSites: number; averageScore: number; critical: number; criticalSites: number; trackedStates: number; trackedMunicipalities: number; technologies: number; averageHeight: number };
  breakdowns: { tecnologia: Breakdown[]; uf: Breakdown[]; status: Breakdown[]; detentor: Breakdown[]; infra: Breakdown[] };
  intelligence: {
    municipalities: VolumeRank[];
    states: VolumeRank[];
    tallest: SiteRow[];
    averageHeightByState: AverageRank[];
    averageHeightByHolder: AverageRank[];
  };
  risk: {
    low: number;
    medium: number;
    high: number;
    critical: number;
    criticalPercent: number;
    states: VolumeRank[];
    municipalities: VolumeRank[];
  };
  operators: {
    cards: Array<{ operator: string; records: number; sites: number }>;
    metrics: OperatorMetric[];
    oriRanking: OperatorMetric[];
    tciRanking: OperatorMetric[];
  };
  options: Record<string, string[]>;
  points: SiteRow[];
  ranking: SiteRow[];
  table: SiteRow[];
  pagination: { page: number; pageSize: number; total: number; pages: number };
  meta: { importedAt: string; sourceName: string; sampled: boolean; fallbackUsed?: boolean };
};
