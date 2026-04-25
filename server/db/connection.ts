import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { migrate } from "./schema";

const storageDir = path.resolve(process.cwd(), "storage");
const dbPath = path.join(storageDir, "msds.db");

let singleton: Database.Database | null = null;

export function getDb() {
  if (!singleton) {
    mkdirSync(storageDir, { recursive: true });
    singleton = new Database(dbPath);
    migrate(singleton);
  }
  return singleton;
}
