import type Database from "better-sqlite3";
import type { RegulatoryCandidate } from "../../shared/types";

interface SeedRow {
  category: string;
  casNo: string;
  chemicalNameKo: string;
  periodValue: string;
  periodUnit: string;
  sourceName: string;
  sourceUrl: string;
}

export function lookupRegulatoryCandidates(db: Database.Database, casNo: string): RegulatoryCandidate[] {
  const rows = db.prepare(`
    SELECT
      category,
      cas_no AS casNo,
      chemical_name_ko AS chemicalNameKo,
      period_value AS periodValue,
      period_unit AS periodUnit,
      source_name AS sourceName,
      source_url AS sourceUrl
    FROM regulatory_seeds
    WHERE cas_no = ?
    ORDER BY category ASC
  `).all(casNo) as SeedRow[];

  return rows.map((row) => ({
    category: row.category,
    casNo: row.casNo,
    chemicalNameKo: row.chemicalNameKo,
    status: "해당 후보",
    period: row.periodValue ? `${row.periodValue}${row.periodUnit}` : "",
    sourceName: row.sourceName,
    sourceUrl: row.sourceUrl
  }));
}
