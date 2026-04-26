import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { migrate } from "./schema";

let singleton: Database.Database | null = null;

export function resolveStorageDir() {
  return path.resolve(process.env.MSDS_STORAGE_DIR || path.join(process.cwd(), "storage"));
}

export function getDb() {
  if (!singleton) {
    const storageDir = resolveStorageDir();
    const dbPath = path.join(storageDir, "msds.db");
    mkdirSync(storageDir, { recursive: true });
    singleton = new Database(dbPath);
    migrate(singleton);
  }
  return singleton;
}
