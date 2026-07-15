import { getWritableDb } from "@/lib/db";
import type { BuildGraphOptions } from "@/sentinel-core/graph/graph-types";
import { buildGraph as buildGraphInternal } from "@/sentinel-core/graph/graph-builder";
import { graphStatus } from "@/sentinel-core/graph/graph-store";
import { searchGraph } from "@/sentinel-core/graph/graph-query";
import { getInsights } from "@/sentinel-core/inference/inference-engine";
import { getRecommendations } from "@/sentinel-core/recommendation/recommendation-engine";
import { municipalityKnowledge, operatorKnowledge, siteKnowledge } from "@/sentinel-core/knowledge/knowledge-summary";

export function buildGraph(options: BuildGraphOptions = {}) {
  return buildGraphInternal(getWritableDb(), options);
}

export function getGraphStatus() {
  return graphStatus(getWritableDb());
}

export function getSiteKnowledge(siteId: number) {
  return siteKnowledge(getWritableDb(), siteId);
}

export function getMunicipalityKnowledge(municipio: string, uf: string) {
  return municipalityKnowledge(getWritableDb(), municipio, uf);
}

export function getOperatorKnowledge(operator: string) {
  return operatorKnowledge(getWritableDb(), operator);
}

export function getRecommendationsForScope(scope = "global") {
  return getRecommendations(getWritableDb(), scope);
}

export function getInsightsForScope(scope = "global") {
  return getInsights(getWritableDb(), scope);
}

export function searchKnowledge(query: string) {
  return { query, results: searchGraph(getWritableDb(), query) };
}
