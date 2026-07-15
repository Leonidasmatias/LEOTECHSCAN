import type { DatabaseSync } from "node:sqlite";

export function ensureSiteNotes(db: DatabaseSync) {
  db.exec(`CREATE TABLE IF NOT EXISTS site_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    site_id INTEGER NOT NULL,
    note TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
}

export function getSiteNotes(db: DatabaseSync, siteId: number) {
  ensureSiteNotes(db);
  return db.prepare("SELECT id,site_id siteId,note,created_at createdAt FROM site_notes WHERE site_id = ? ORDER BY id DESC LIMIT 100").all(siteId);
}

export function addSiteNote(db: DatabaseSync, siteId: number, note: string) {
  ensureSiteNotes(db);
  const clean = note.trim().slice(0, 1000);
  if (!clean) throw new Error("Nota vazia.");
  const result = db.prepare("INSERT INTO site_notes (site_id,note,created_at) VALUES (?,?,CURRENT_TIMESTAMP)").run(siteId, clean);
  return db.prepare("SELECT id,site_id siteId,note,created_at createdAt FROM site_notes WHERE id = ?").get(result.lastInsertRowid);
}
