import rules from "@/config/sentinel_rules.json";

export type MunicipalityMetrics = {
  municipio: string;
  uf: string;
  records: number;
  sites: number;
  operators: number;
  technologies: number;
  population: number;
  avgGeo: number;
};

export type ScoreResult = {
  score: number;
  level: string;
  stars: number;
  color: string;
};

function clamp(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function ratio(value: number, max: number) {
  if (!max) return 0;
  return Math.max(0, Math.min(1, value / max));
}

function weighted(parts: Record<string, number>, weights: Record<string, number>) {
  const total = Object.values(weights).reduce((sum, value) => sum + value, 0) || 1;
  return clamp(Object.entries(weights).reduce((sum, [key, weight]) => sum + (parts[key] ?? 0) * weight, 0) / total);
}

function ltsLevel(score: number): ScoreResult {
  const level = rules.lts.levels.find((item) => score >= item.min && score <= item.max) ?? rules.lts.levels[0];
  return { score, level: level.name, stars: level.stars, color: level.color };
}

function sriLevel(score: number): ScoreResult {
  const level = rules.sri.levels.find((item) => score >= item.min && score <= item.max) ?? rules.sri.levels[0];
  return { score, level: level.name, stars: Math.max(1, Math.ceil(score / 20)), color: level.color };
}

export function calculateLts(item: MunicipalityMetrics, maxima: MunicipalityMetrics): ScoreResult {
  const coverage = ratio(item.sites, maxima.sites) * 100;
  const density = ratio(item.records, maxima.records) * 100;
  const operators = ratio(item.operators, maxima.operators) * 100;
  const technologies = ratio(item.technologies, maxima.technologies) * 100;
  const potential = ratio(item.population, maxima.population) * 100;
  return ltsLevel(weighted({ coverage, density, operators, technologies, potential }, rules.lts.weights));
}

export function calculateTci(item: MunicipalityMetrics, maxima: MunicipalityMetrics) {
  return clamp(ratio(item.sites, maxima.sites) * 35 + ratio(item.records, maxima.records) * 25 + ratio(item.operators, maxima.operators) * 20 + ratio(item.technologies, maxima.technologies) * 20);
}

export function calculateOpi(item: MunicipalityMetrics, maxima: MunicipalityMetrics) {
  const fewSites = (1 - ratio(item.sites, maxima.sites)) * 100;
  const fewOperators = (1 - ratio(item.operators, maxima.operators)) * 100;
  const lowCoverage = (1 - ratio(item.records, maxima.records)) * 100;
  const lowDensity = item.population ? (1 - ratio(item.sites / Math.max(item.population, 1), maxima.sites / Math.max(maxima.population, 1))) * 100 : 40;
  return weighted({ fewSites, fewOperators, lowCoverage, lowDensity }, rules.opi.weights);
}

export function calculateSri(item: MunicipalityMetrics, maxima: MunicipalityMetrics): ScoreResult {
  const lowCoverage = (1 - ratio(item.sites, maxima.sites)) * 100;
  const lowRedundancy = item.sites <= 1 ? 100 : item.sites <= 3 ? 70 : item.sites <= 8 ? 40 : 10;
  const lowPresence = (1 - ratio(item.records, maxima.records)) * 100;
  const lowDiversity = (1 - ratio(item.operators + item.technologies, maxima.operators + maxima.technologies)) * 100;
  return sriLevel(weighted({ lowCoverage, lowRedundancy, lowPresence, lowDiversity }, rules.sri.weights));
}

export function stars(value: number) {
  return "*****".slice(0, Math.max(1, Math.min(5, value))).padEnd(5, "☆").replace(/\*/g, "★");
}

export const sentinelRules = rules;
