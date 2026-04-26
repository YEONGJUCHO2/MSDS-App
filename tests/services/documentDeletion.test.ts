import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { deleteDocumentRecord, insertDocument, insertManualComponentRow, upsertDocumentBasicInfo } from "../../server/db/repositories";
import { migrate } from "../../server/db/schema";

describe("document deletion", () => {
  it("removes the MSDS document data while preserving product/site rows as unlinked records", () => {
    const db = new Database(":memory:");
    migrate(db);
    insertDocument(db, {
      documentId: "doc-1",
      fileName: "sample.pdf",
      fileHash: "hash",
      storagePath: "/tmp/sample.pdf",
      status: "needs_review"
    });
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
    db.prepare(`
      INSERT INTO watchlist (watch_id, cas_no, chemical_name, last_source_name, last_checked_at, status)
      VALUES ('watch-1', '96-29-7', 'Methylethylketoxime', 'KECO', '2026-04-25T00:00:00.000Z', 'official_api_matched')
    `).run();
    upsertDocumentBasicInfo(db, "doc-1", [
      { key: "productName", label: "제품명", value: "sample", source: "user_saved" }
    ]);
    db.prepare(`
      INSERT INTO products (
        product_id, document_id, document_file_name, product_name, supplier,
        manufacturer, site_names, registration_status, created_at
      ) VALUES ('product-1', 'doc-1', 'sample.pdf', 'sample', '', '', 'A현장', 'linked', '2026-04-25')
    `).run();

    expect(deleteDocumentRecord(db, "doc-1")).toEqual({ storagePath: "/tmp/sample.pdf" });

    expect(db.prepare("SELECT COUNT(*) AS count FROM documents").get()).toEqual({ count: 0 });
    expect(db.prepare("SELECT COUNT(*) AS count FROM components").get()).toEqual({ count: 0 });
    expect(db.prepare("SELECT COUNT(*) AS count FROM review_queue").get()).toEqual({ count: 0 });
    expect(db.prepare("SELECT COUNT(*) AS count FROM regulatory_matches").get()).toEqual({ count: 0 });
    expect(db.prepare("SELECT COUNT(*) AS count FROM document_basic_info").get()).toEqual({ count: 0 });
    expect(db.prepare("SELECT COUNT(*) AS count FROM watchlist").get()).toEqual({ count: 0 });
    expect(db.prepare("SELECT document_id AS documentId, document_file_name AS fileName, registration_status AS status FROM products").get()).toEqual({
      documentId: "",
      fileName: "",
      status: "not_registered"
    });
  });

  it("keeps watchlist rows when another registered MSDS still uses the same CAS No.", () => {
    const db = new Database(":memory:");
    migrate(db);
    insertDocument(db, {
      documentId: "doc-1",
      fileName: "first.pdf",
      fileHash: "hash-1",
      storagePath: "/tmp/first.pdf",
      status: "needs_review"
    });
    insertDocument(db, {
      documentId: "doc-2",
      fileName: "second.pdf",
      fileHash: "hash-2",
      storagePath: "/tmp/second.pdf",
      status: "needs_review"
    });
    insertManualComponentRow(db, "doc-1", {
      casNoCandidate: "96-29-7",
      chemicalNameCandidate: "Methylethylketoxime",
      contentMinCandidate: "0.1",
      contentMaxCandidate: "1",
      contentSingleCandidate: ""
    });
    insertManualComponentRow(db, "doc-2", {
      casNoCandidate: "96-29-7",
      chemicalNameCandidate: "Methylethylketoxime",
      contentMinCandidate: "0.1",
      contentMaxCandidate: "1",
      contentSingleCandidate: ""
    });
    db.prepare(`
      INSERT INTO watchlist (watch_id, cas_no, chemical_name, last_source_name, last_checked_at, status)
      VALUES ('watch-1', '96-29-7', 'Methylethylketoxime', 'KECO', '2026-04-25T00:00:00.000Z', 'official_api_matched')
    `).run();

    expect(deleteDocumentRecord(db, "doc-1")).toEqual({ storagePath: "/tmp/first.pdf" });

    expect(db.prepare("SELECT cas_no AS casNo FROM watchlist").all()).toEqual([{ casNo: "96-29-7" }]);
  });
});
