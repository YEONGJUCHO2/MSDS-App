import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { migrate } from "../../server/db/schema";
import { importRegulatorySeedCsv } from "../../server/importers/regulatorySeedImport";
import { lookupRegulatoryCandidates } from "../../server/services/regulatoryLookup";

describe("regulatory lookup", () => {
  it("returns CAS-based candidate statuses with source evidence", () => {
    const db = new Database(":memory:");
    migrate(db);
    importRegulatorySeedCsv(db, [
      "category,cas_no,chemical_name_ko,chemical_name_en,synonyms,threshold_text,period_value,period_unit,source_name,source_url,source_revision_date,note",
      "specialHealthExam,67-64-1,아세톤,Acetone,,특수검진 후보,12,개월,내부 기준표,internal://seed,2026-04-25,검수 필요"
    ].join("\n"));

    expect(lookupRegulatoryCandidates(db, "67-64-1")).toEqual([
      {
        category: "specialHealthExam",
        casNo: "67-64-1",
        chemicalNameKo: "아세톤",
        status: "해당 후보",
        period: "12개월",
        sourceName: "내부 기준표",
        sourceUrl: "internal://seed"
      }
    ]);
  });
});
