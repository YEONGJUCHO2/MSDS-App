import { readFileSync } from "node:fs";
import path from "node:path";
import { getDb } from "../db/connection";
import { importRegulatorySeedCsv } from "../importers/regulatorySeedImport";

const seedPath = path.resolve(process.cwd(), "data", "regulatory-seeds", "internal-criteria.sample.csv");
const csv = readFileSync(seedPath, "utf8");
const result = importRegulatorySeedCsv(getDb(), csv);
console.log(`Imported ${result.imported} regulatory seed rows.`);
