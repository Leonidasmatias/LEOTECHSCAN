import type { DatabaseSync } from "node:sqlite";
import { ensureGraphTables } from "@/sentinel-core/graph/graph-store";

export function neighbors(db: DatabaseSync, nodeId: string, limit = 50) {
  ensureGraphTables(db);
  return db.prepare(`SELECT e.relation_type relationType,n.node_id nodeId,n.node_type nodeType,n.label,n.attributes_json attributesJson
    FROM sig_edges e JOIN sig_nodes n ON n.node_id=e.target_node_id
    WHERE e.source_node_id=? ORDER BY e.id LIMIT ?`).all(nodeId, limit);
}

export function searchGraph(db: DatabaseSync, query: string) {
  ensureGraphTables(db);
  const like = `%${query}%`;
  return db.prepare("SELECT node_id nodeId,node_type nodeType,label,ref_table refTable,ref_id refId,attributes_json attributesJson FROM sig_nodes WHERE label LIKE ? OR node_id LIKE ? ORDER BY node_type,label LIMIT 80").all(like, like);
}
