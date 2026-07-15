import type { DatabaseSync } from "node:sqlite";

export function ensureAuditTrail(db: DatabaseSync) {
  db.exec(`CREATE TABLE IF NOT EXISTS audit_trail (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    description TEXT,
    metadata_json TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
}

export function recordAudit(db: DatabaseSync, eventType: string, entityType: string, entityId: string | number, description: string, metadata: Record<string, unknown> = {}) {
  ensureAuditTrail(db);
  db.prepare("INSERT INTO audit_trail (event_type,entity_type,entity_id,description,metadata_json,created_at) VALUES (?,?,?,?,?,CURRENT_TIMESTAMP)")
    .run(eventType, entityType, String(entityId), description, JSON.stringify(metadata));
}

export function auditTrailRows(db: DatabaseSync, limit = 200) {
  ensureAuditTrail(db);
  return db.prepare("SELECT id,event_type eventType,entity_type entityType,entity_id entityId,description,metadata_json metadataJson,created_at createdAt FROM audit_trail ORDER BY id DESC LIMIT ?").all(limit);
}
