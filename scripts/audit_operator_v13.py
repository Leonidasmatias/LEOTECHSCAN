from __future__ import annotations

import argparse
import json
import sqlite3
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser(description="Auditoria somente leitura do SQLite LeoTechScan V1.3")
    parser.add_argument("--database", required=True)
    args = parser.parse_args()
    database = Path(args.database).resolve()
    conn = sqlite3.connect(f"file:{database.as_posix()}?mode=ro", uri=True)
    integrity = conn.execute("PRAGMA integrity_check").fetchone()[0]
    total = conn.execute("SELECT COUNT(*) FROM sites").fetchone()[0]
    classified = conn.execute("SELECT COUNT(*) FROM sites WHERE operadora_classificada IS NOT NULL AND ori_score BETWEEN 0 AND 100").fetchone()[0]
    distribution = dict(conn.execute("SELECT operadora_classificada,COUNT(*) FROM sites GROUP BY operadora_classificada"))
    ori = conn.execute("SELECT MIN(ori_score),MAX(ori_score),ROUND(AVG(ori_score),1) FROM sites").fetchone()
    metadata = dict(conn.execute("SELECT key,value FROM metadata WHERE key IN ('schema_version','operator_rules_version','operator_rules_sha256')"))
    conn.close()
    result = {"integrity": integrity, "total": total, "classified_and_scored": classified, "distribution": distribution, "ori": {"min": ori[0], "max": ori[1], "average": ori[2]}, "metadata": metadata}
    print(json.dumps(result, ensure_ascii=False))
    if integrity != "ok" or total != 298341 or classified != total or metadata.get("schema_version") != "1.3": raise SystemExit(1)


if __name__ == "__main__":
    main()
