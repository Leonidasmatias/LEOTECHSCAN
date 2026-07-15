import type { DatabaseSync } from "node:sqlite";
import type { SigEdge, SigNode } from "@/sentinel-core/graph/graph-types";

export function ensureGraphTables(db: DatabaseSync) {
  db.exec(`CREATE TABLE IF NOT EXISTS sig_nodes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    node_id TEXT NOT NULL UNIQUE,
    node_type TEXT NOT NULL,
    label TEXT,
    ref_table TEXT,
    ref_id TEXT,
    attributes_json TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS sig_edges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    edge_id TEXT NOT NULL UNIQUE,
    source_node_id TEXT NOT NULL,
    target_node_id TEXT NOT NULL,
    relation_type TEXT NOT NULL,
    weight REAL DEFAULT 1,
    attributes_json TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS sig_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    snapshot_name TEXT,
    node_count INTEGER,
    edge_count INTEGER,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    metadata_json TEXT
  );
  CREATE TABLE IF NOT EXISTS sig_insights (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    insight_type TEXT,
    scope_type TEXT,
    scope_id TEXT,
    title TEXT,
    description TEXT,
    score INTEGER,
    recommendation TEXT,
    evidence_json TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
}

export function resetGraph(db: DatabaseSync) {
  ensureGraphTables(db);
  db.exec("DELETE FROM sig_edges; DELETE FROM sig_nodes; DELETE FROM sig_insights;");
}

export function upsertNode(db: DatabaseSync, node: SigNode) {
  db.prepare("INSERT INTO sig_nodes (node_id,node_type,label,ref_table,ref_id,attributes_json,created_at,updated_at) VALUES (?,?,?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) ON CONFLICT(node_id) DO UPDATE SET label=excluded.label,attributes_json=excluded.attributes_json,updated_at=CURRENT_TIMESTAMP")
    .run(node.nodeId, node.nodeType, node.label, node.refTable || "", String(node.refId ?? ""), JSON.stringify(node.attributes || {}));
}

export function upsertEdge(db: DatabaseSync, edge: SigEdge) {
  db.prepare("INSERT OR IGNORE INTO sig_edges (edge_id,source_node_id,target_node_id,relation_type,weight,attributes_json,created_at) VALUES (?,?,?,?,?,?,CURRENT_TIMESTAMP)")
    .run(edge.edgeId, edge.sourceNodeId, edge.targetNodeId, edge.relationType, edge.weight ?? 1, JSON.stringify(edge.attributes || {}));
}

export function graphStatus(db: DatabaseSync) {
  ensureGraphTables(db);
  const nodes = Number((db.prepare("SELECT COUNT(*) total FROM sig_nodes").get() as Record<string, unknown>).total || 0);
  const edges = Number((db.prepare("SELECT COUNT(*) total FROM sig_edges").get() as Record<string, unknown>).total || 0);
  const insights = Number((db.prepare("SELECT COUNT(*) total FROM sig_insights").get() as Record<string, unknown>).total || 0);
  const lastSnapshot = db.prepare("SELECT snapshot_name snapshotName,node_count nodeCount,edge_count edgeCount,created_at createdAt,metadata_json metadataJson FROM sig_snapshots ORDER BY id DESC LIMIT 1").get();
  return { status: nodes ? "READY" : "EMPTY", nodes, edges, insights, lastSnapshot };
}

export function saveSnapshot(db: DatabaseSync, name: string, metadata: Record<string, unknown>) {
  const status = graphStatus(db);
  db.prepare("INSERT INTO sig_snapshots (snapshot_name,node_count,edge_count,metadata_json,created_at) VALUES (?,?,?,?,CURRENT_TIMESTAMP)")
    .run(name, status.nodes, status.edges, JSON.stringify(metadata));
  return graphStatus(db);
}
