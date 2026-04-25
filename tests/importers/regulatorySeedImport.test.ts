import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { migrate } from "../../server/db/schema";
import { importRegulatorySeedCsv } from "../../server/importers/regulatorySeedImport";

describe("regulatory seed import", () => {
  it("imports CAS-based regulatory standards from CSV", () => {
    const db = new Database(":memory:");
    migrate(db);
    const csv = [
      "category,cas_no,chemical_name_ko,chemical_name_en,synonyms,threshold_text,period_value,period_unit,source_name,source_url,source_revision_date,note",
      "workEnvironmentMeasurement,1344-28-1,산화 알루미늄,Aluminium oxide,,분진 노출 기준,6,개월,내부 기준표,internal://seed,2026-04-25,작업환경측정 후보",
      "specialHealthExam,1344-28-1,산화 알루미늄,Aluminium oxide,,특수건강검진 기준,12,개월,내부 기준표,internal://seed,2026-04-25,특수검진 후보"
    ].join("\n");

    const result = importRegulatorySeedCsv(db, csv);
    const rows = db.prepare("SELECT category, cas_no AS casNo, period_value AS periodValue FROM regulatory_seeds ORDER BY category").all();

    expect(result.imported).toBe(2);
    expect(rows).toEqual([
      { category: "specialHealthExam", casNo: "1344-28-1", periodValue: "12" },
      { category: "workEnvironmentMeasurement", casNo: "1344-28-1", periodValue: "6" }
    ]);
  });
});
