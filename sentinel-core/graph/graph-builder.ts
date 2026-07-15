import type { DatabaseSync } from "node:sqlite";
import { ensureGraphTables, resetGraph, saveSnapshot, upsertEdge, upsertNode } from "@/sentinel-core/graph/graph-store";
import type { BuildGraphOptions } from "@/sentinel-core/graph/graph-types";
import { runInference } from "@/sentinel-core/inference/inference-engine";

function clean(value: unknown, fallback = "Nao informado") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function id(prefix: string, value: unknown) {
  return `${prefix}:${clean(value).toUpperCase().replace(/[^A-Z0-9]+/g, "_")}`;
}

export function buildGraph(db: DatabaseSync, options: BuildGraphOptions = {}) {
  ensureGraphTables(db);
  if (options.reset !== false) resetGraph(db);
  const limit = Math.max(1, Math.min(5000, Number(options.limit || 1000)));
  const rows = db.prepare(`SELECT s.id,s.site,s.operadora_origem,s.municipio,s.uf,s.tecnologia,s.projeto,s.latitude,s.longitude,s.ori_score,t.trust_score,t.trust_badge,v.validation_score satellite_score
    FROM sites s
    LEFT JOIN site_trust_scores t ON t.site_id=s.id
    LEFT JOIN site_satellite_validation v ON v.site_id=s.id
    ORDER BY s.id LIMIT ?`).all(limit) as Record<string, unknown>[];

  for (const row of rows) {
    const siteNode = `SITE:${row.id}`;
    const municipalityNode = id("MUNICIPALITY", `${row.municipio}:${row.uf}`);
    const stateNode = id("STATE", row.uf);
    const operatorNode = id("OPERATOR", row.operadora_origem);
    const technologyNode = id("TECHNOLOGY", row.tecnologia);
    const coordinateNode = `COORDINATE:${row.id}`;

    upsertNode(db, { nodeId: siteNode, nodeType: "SITE", label: clean(row.site), refTable: "sites", refId: String(row.id), attributes: row });
    upsertNode(db, { nodeId: municipalityNode, nodeType: "MUNICIPALITY", label: `${clean(row.municipio)}/${clean(row.uf)}`, refTable: "sites", refId: `${row.municipio}/${row.uf}` });
    upsertNode(db, { nodeId: stateNode, nodeType: "STATE", label: clean(row.uf), refTable: "sites", refId: clean(row.uf) });
    upsertNode(db, { nodeId: operatorNode, nodeType: "OPERATOR", label: clean(row.operadora_origem), refTable: "sites", refId: clean(row.operadora_origem) });
    upsertNode(db, { nodeId: technologyNode, nodeType: "TECHNOLOGY", label: clean(row.tecnologia), refTable: "sites", refId: clean(row.tecnologia) });
    upsertNode(db, { nodeId: coordinateNode, nodeType: "COORDINATE", label: `${row.latitude},${row.longitude}`, refTable: "sites", refId: String(row.id), attributes: { latitude: row.latitude, longitude: row.longitude } });

    upsertEdge(db, { edgeId: `${siteNode}->LOCATED_IN->${municipalityNode}`, sourceNodeId: siteNode, targetNodeId: municipalityNode, relationType: "LOCATED_IN" });
    upsertEdge(db, { edgeId: `${municipalityNode}->LOCATED_IN->${stateNode}`, sourceNodeId: municipalityNode, targetNodeId: stateNode, relationType: "LOCATED_IN" });
    upsertEdge(db, { edgeId: `${siteNode}->BELONGS_TO_OPERATOR->${operatorNode}`, sourceNodeId: siteNode, targetNodeId: operatorNode, relationType: "BELONGS_TO_OPERATOR" });
    upsertEdge(db, { edgeId: `${siteNode}->HAS_TECHNOLOGY->${technologyNode}`, sourceNodeId: siteNode, targetNodeId: technologyNode, relationType: "HAS_TECHNOLOGY" });
    upsertEdge(db, { edgeId: `${siteNode}->HAS_COORDINATE->${coordinateNode}`, sourceNodeId: siteNode, targetNodeId: coordinateNode, relationType: "HAS_COORDINATE" });

    if (row.projeto) {
      const projectNode = id("PROJECT", row.projeto);
      upsertNode(db, { nodeId: projectNode, nodeType: "PROJECT", label: clean(row.projeto), refTable: "sites", refId: clean(row.projeto) });
      upsertEdge(db, { edgeId: `${siteNode}->HAS_PROJECT->${projectNode}`, sourceNodeId: siteNode, targetNodeId: projectNode, relationType: "HAS_PROJECT" });
    }
    if (row.trust_score) {
      const trustNode = `TRUST_SCORE:${row.id}`;
      upsertNode(db, { nodeId: trustNode, nodeType: "TRUST_SCORE", label: `${row.trust_score} ${row.trust_badge || ""}`, refTable: "site_trust_scores", refId: String(row.id), attributes: { trustScore: row.trust_score, trustBadge: row.trust_badge } });
      upsertEdge(db, { edgeId: `${siteNode}->HAS_TRUST_SCORE->${trustNode}`, sourceNodeId: siteNode, targetNodeId: trustNode, relationType: "HAS_TRUST_SCORE", weight: Number(row.trust_score) / 100 });
    }
    if (row.satellite_score) {
      const satNode = `SATELLITE_VALIDATION:${row.id}`;
      upsertNode(db, { nodeId: satNode, nodeType: "SATELLITE_VALIDATION", label: `Copernicus ${row.satellite_score}`, refTable: "site_satellite_validation", refId: String(row.id), attributes: { score: row.satellite_score } });
      upsertEdge(db, { edgeId: `${siteNode}->HAS_SATELLITE_EVIDENCE->${satNode}`, sourceNodeId: siteNode, targetNodeId: satNode, relationType: "HAS_SATELLITE_EVIDENCE", weight: Number(row.satellite_score) / 100 });
    }
  }

  const insights = runInference(db);
  return { ...saveSnapshot(db, "sig_sample_build", { limit, rows: rows.length, mode: "sample" }), processedSites: rows.length, generatedInsights: insights.length };
}
