import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { insertDocument, insertManualComponentRow, listComponentRows, removeComponentRow, updateComponentCandidate } from "../../server/db/repositories";
import { migrate } from "../../server/db/schema";

describe("component editing", () => {
  it("adds manual component rows at the end of the current document", () => {
    const db = new Database(":memory:");
    migrate(db);
    insertDocument(db, { documentId: "doc-1", fileName: "sample.pdf", fileHash: "hash", storagePath: "", status: "needs_review" });

    const rowId = insertManualComponentRow(db, "doc-1", {
      casNoCandidate: "96-29-7",
      chemicalNameCandidate: "Methylethylketoxime",
      contentMinCandidate: "0.1",
      contentMaxCandidate: "1",
      contentSingleCandidate: ""
    });

    expect(rowId).toEqual(expect.any(String));
    expect(listComponentRows(db, "doc-1")).toMatchObject([
      {
        rowIndex: 0,
        casNoCandidate: "96-29-7",
        chemicalNameCandidate: "Methylethylketoxime",
        contentText: "0.1~1",
        evidenceLocation: "수동 추가",
        aiReviewStatus: "ai_needs_attention",
        regulatoryMatchStatus: "not_checked"
      }
    ]);
  });

  it("preserves regulatory matches when saving an unchanged component candidate", () => {
    const db = new Database(":memory:");
    migrate(db);
    insertDocument(db, { documentId: "doc-1", fileName: "sample.pdf", fileHash: "hash", storagePath: "", status: "needs_review" });
    const rowId = insertManualComponentRow(db, "doc-1", {
      casNoCandidate: "96-29-7",
      chemicalNameCandidate: "Methylethylketoxime",
      contentMinCandidate: "0.1",
      contentMaxCandidate: "1",
      contentSingleCandidate: ""
    });
    db.prepare(`
      INSERT INTO regulatory_matches (
        match_id, row_id, document_id, cas_no, category, status, source_type,
        source_name, source_url, evidence_text, checked_at
      ) VALUES ('match-1', ?, 'doc-1', '96-29-7', 'toxic', '공식 API 조회됨', 'official_api', 'KECO', '', '', '2026-04-25')
    `).run(rowId);
    db.prepare("UPDATE components SET regulatory_match_status = 'official_api_matched' WHERE row_id = ?").run(rowId);

    updateComponentCandidate(db, rowId, {
      casNoCandidate: "96-29-7",
      chemicalNameCandidate: "Methylethylketoxime",
      contentMinCandidate: "0.1",
      contentMaxCandidate: "1",
      contentSingleCandidate: ""
    });

    expect(listComponentRows(db, "doc-1")[0].regulatoryMatches).toHaveLength(1);
    expect(listComponentRows(db, "doc-1")[0].regulatoryMatchStatus).toBe("official_api_matched");
  });

  it("updates changed component candidates and clears stale regulatory matches", () => {
    const db = new Database(":memory:");
    migrate(db);
    insertDocument(db, { documentId: "doc-1", fileName: "sample.pdf", fileHash: "hash", storagePath: "", status: "needs_review" });
    const rowId = insertManualComponentRow(db, "doc-1", {
      casNoCandidate: "96-29-7",
      chemicalNameCandidate: "Methylethylketoxime",
      contentMinCandidate: "0.1",
      contentMaxCandidate: "1",
      contentSingleCandidate: ""
    });
    db.prepare(`
      INSERT INTO regulatory_matches (
        match_id, row_id, document_id, cas_no, category, status, source_type,
        source_name, source_url, evidence_text, checked_at
      ) VALUES ('match-1', ?, 'doc-1', '96-29-7', 'toxic', '공식 API 조회됨', 'official_api', 'KECO', '', '', '2026-04-25')
    `).run(rowId);

    updateComponentCandidate(db, rowId, {
      casNoCandidate: "7439-89-6",
      chemicalNameCandidate: "Iron",
      contentMinCandidate: "65",
      contentMaxCandidate: "75",
      contentSingleCandidate: ""
    });

    expect(listComponentRows(db, "doc-1")).toMatchObject([
      {
        casNoCandidate: "7439-89-6",
        chemicalNameCandidate: "Iron",
        contentText: "65~75",
        regulatoryMatchStatus: "not_checked",
        regulatoryMatches: []
      }
    ]);
  });

  it("removes component rows from review and export lists", () => {
    const db = new Database(":memory:");
    migrate(db);
    insertDocument(db, { documentId: "doc-1", fileName: "sample.pdf", fileHash: "hash", storagePath: "", status: "needs_review" });
    const rowId = insertManualComponentRow(db, "doc-1", {
      casNoCandidate: "96-29-7",
      chemicalNameCandidate: "Methylethylketoxime",
      contentMinCandidate: "0.1",
      contentMaxCandidate: "1",
      contentSingleCandidate: ""
    });

    removeComponentRow(db, rowId);

    expect(listComponentRows(db, "doc-1")).toEqual([]);
    expect(db.prepare("SELECT COUNT(*) AS count FROM review_queue").get()).toEqual({ count: 0 });
  });
});
