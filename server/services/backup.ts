import type Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";

export async function backupDatabase(db: Database.Database, backupDir = path.resolve(process.cwd(), "storage", "backups")) {
  mkdirSync(backupDir, { recursive: true });
  const fileName = `msds-${new Date().toISOString().replace(/[:.]/g, "-")}.db`;
  const target = path.join(backupDir, fileName);
  await db.backup(target);
  return { path: target };
}
