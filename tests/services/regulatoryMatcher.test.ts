import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { migrate } from "../../server/db/schema";
import { insertComponentRows, insertDocument, updateComponentReviewStatus } from "../../server/db/repositories";
import { importRegulatorySeedCsv } from "../../server/importers/regulatorySeedImport";
import { matchAndStoreRegulatoryData, recheckComponentRegulatoryData } from "../../server/services/regulatoryMatcher";

describe("regulatory matcher", () => {
  it("stores seed matches and watchlist rows by CAS No.", async () => {
    const db = new Database(":memory:");
    migrate(db);
    insertDocument(db, { documentId: "doc-1", fileName: "sample.pdf", fileHash: "hash", storagePath: "", status: "needs_review" });
    insertComponentRows(db, "doc-1", [{
      rowId: "row-1",
      rowIndex: 0,
      rawRowText: "Acetone 67-64-1 30~60%",
      casNoCandidate: "67-64-1",
      chemicalNameCandidate: "Acetone",
      contentMinCandidate: "30",
      contentMaxCandidate: "60",
      contentSingleCandidate: "",
      contentText: "30~60",
      confidence: 0.82,
      evidenceLocation: "SECTION 3 / row 1",
      reviewStatus: "needs_review"
    }]);
    importRegulatorySeedCsv(db, [
      "category,cas_no,chemical_name_ko,chemical_name_en,synonyms,threshold_text,period_value,period_unit,source_name,source_url,source_revision_date,note",
      "specialHealthExam,67-64-1,아세톤,Acetone,,특수검진 후보,12,개월,내부 기준표,internal://seed,2026-04-25,검수 필요"
    ].join("\n"));

    const result = await matchAndStoreRegulatoryData(db, "doc-1", [
      { rowId: "row-1", casNoCandidate: "67-64-1", chemicalNameCandidate: "Acetone" }
    ]);

    expect(result).toEqual([{ rowId: "row-1", seedMatches: 1, apiMatches: 0, status: "internal_seed_matched" }]);
    expect(db.prepare("SELECT cas_no AS casNo, source_type AS sourceType FROM regulatory_matches").all()).toEqual([
      { casNo: "67-64-1", sourceType: "internal_seed" }
    ]);
    expect(db.prepare("SELECT cas_no AS casNo, chemical_name AS chemicalName FROM watchlist").all()).toEqual([
      { casNo: "67-64-1", chemicalName: "Acetone" }
    ]);
  });

  it("rechecks a component without duplicating previous matches", async () => {
    const db = new Database(":memory:");
    migrate(db);
    insertDocument(db, { documentId: "doc-1", fileName: "sample.pdf", fileHash: "hash", storagePath: "", status: "needs_review" });
    insertComponentRows(db, "doc-1", [{
      rowId: "row-1",
      rowIndex: 0,
      rawRowText: "Acetone 67-64-1 30~60%",
      casNoCandidate: "67-64-1",
      chemicalNameCandidate: "Acetone",
      contentMinCandidate: "30",
      contentMaxCandidate: "60",
      contentSingleCandidate: "",
      contentText: "30~60",
      confidence: 0.82,
      evidenceLocation: "SECTION 3 / row 1",
      reviewStatus: "needs_review"
    }]);
    importRegulatorySeedCsv(db, [
      "category,cas_no,chemical_name_ko,chemical_name_en,synonyms,threshold_text,period_value,period_unit,source_name,source_url,source_revision_date,note",
      "specialHealthExam,67-64-1,아세톤,Acetone,,특수검진 후보,12,개월,내부 기준표,internal://seed,2026-04-25,검수 필요"
    ].join("\n"));

    await recheckComponentRegulatoryData(db, "doc-1", "row-1");
    await recheckComponentRegulatoryData(db, "doc-1", "row-1");

    expect(db.prepare("SELECT COUNT(*) AS count FROM regulatory_matches").get()).toEqual({ count: 1 });
  });

  it("updates component and queue review status together", () => {
    const db = new Database(":memory:");
    migrate(db);
    insertDocument(db, { documentId: "doc-1", fileName: "sample.pdf", fileHash: "hash", storagePath: "", status: "needs_review" });
    insertComponentRows(db, "doc-1", [{
      rowId: "row-1",
      rowIndex: 0,
      rawRowText: "Acetone 67-64-1 30~60%",
      casNoCandidate: "67-64-1",
      chemicalNameCandidate: "Acetone",
      contentMinCandidate: "30",
      contentMaxCandidate: "60",
      contentSingleCandidate: "",
      contentText: "30~60",
      confidence: 0.82,
      evidenceLocation: "SECTION 3 / row 1",
      reviewStatus: "needs_review"
    }]);

    updateComponentReviewStatus(db, "row-1", "approved");

    expect(db.prepare("SELECT review_status AS reviewStatus FROM components").get()).toEqual({ reviewStatus: "approved" });
    expect(db.prepare("SELECT review_status AS reviewStatus FROM review_queue").get()).toEqual({ reviewStatus: "approved" });
  });

  it("updates legacy queue rows that were created before entity ids existed", () => {
    const db = new Database(":memory:");
    migrate(db);
    insertDocument(db, { documentId: "doc-1", fileName: "sample.pdf", fileHash: "hash", storagePath: "", status: "needs_review" });
    insertComponentRows(db, "doc-1", [{
      rowId: "row-1",
      rowIndex: 0,
      rawRowText: "Acetone 67-64-1 30~60%",
      casNoCandidate: "67-64-1",
      chemicalNameCandidate: "Acetone",
      contentMinCandidate: "30",
      contentMaxCandidate: "60",
      contentSingleCandidate: "",
      contentText: "30~60",
      confidence: 0.82,
      evidenceLocation: "SECTION 3 / row 1",
      reviewStatus: "needs_review"
    }]);
    db.prepare("UPDATE review_queue SET entity_id = ''").run();

    updateComponentReviewStatus(db, "row-1", "excluded");

    expect(db.prepare("SELECT entity_id AS entityId, review_status AS reviewStatus FROM review_queue").get()).toEqual({
      entityId: "row-1",
      reviewStatus: "excluded"
    });
  });
});
