import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";

let db: DatabaseSync | undefined;
let writableDb: DatabaseSync | undefined;

function databasePath() {
  const localDatabase = path.join(process.cwd(), "DATABASE", "leotechscan.db");
  return process.env.LEOTECHSCAN_DB || (fs.existsSync(localDatabase)
    ? localDatabase
    : path.join(process.cwd(), "..", "DATABASE", "leotechscan.db"));
}

export function getDb() {
  if (!db) {
    db = new DatabaseSync(databasePath(), { readOnly: true });
    db.exec("PRAGMA query_only = ON; PRAGMA cache_size = -64000;");
  }
  return db;
}

export function getWritableDb() {
  if (!writableDb) {
    writableDb = new DatabaseSync(databasePath());
    writableDb.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
  }
  return writableDb;
}

export function text(value: unknown) {
  return String(value ?? "Não informado");
}
