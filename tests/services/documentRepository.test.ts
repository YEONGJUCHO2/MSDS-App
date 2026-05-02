import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { approveDocumentAfterReplacement, insertDocument, markDocumentNeedsReview, renameDocument } from "../../server/db/repositories";
import { createSqliteDocumentRepository } from "../../server/db/sqliteDocumentRepository";
import { migrate } from "../../server/db/schema";

describe("sqlite document repository", () => {
  it("creates, updates, and counts review data through the narrow repository boundary", async () => {
    const db = new Database(":memory:");
    migrate(db);
    const repo = createSqliteDocumentRepository(db);

    const documentId = await repo.insertDocument({
      documentId: "doc-1",
      fileName: "sample.pdf",
      fileHash: "hash",
      storagePath: "doc-1/sample.pdf",
      status: "uploaded"
    });

    await repo.upsertDocumentText(documentId, "3. 구성성분", 1, "needs_review");
    await repo.insertComponentRows(documentId, [{
      rowId: "row-1",
      rowIndex: 0,
      rawRowText: "Trade secret 12345-67-8",
      casNoCandidate: "12345-67-8",
      chemicalNameCandidate: "Trade secret",
      contentMinCandidate: "",
      contentMaxCandidate: "",
      contentSingleCandidate: "",
      contentText: "",
      confidence: 0.6,
      evidenceLocation: "section 3",
      reviewStatus: "needs_review"
    }]);

    expect(documentId).toBe("doc-1");
    await expect(repo.findDocumentId(documentId)).resolves.toBe("doc-1");
    await expect(repo.countNeedsReview(documentId)).resolves.toBe(1);
  });

  it("defaults new MSDS documents to approved and stores lifecycle changes", () => {
    const db = new Database(":memory:");
    migrate(db);
    const documentId = insertLifecycleDocument(db);

    expect(readDocumentLifecycle(db, documentId)).toMatchObject({
      fileName: "sample.pdf",
      reviewState: "approved",
      reviewReason: "",
      reviewRequiredAt: "",
      reviewCompletedAt: "",
      replacementUploadedAt: ""
    });

    renameDocument(db, documentId, "renamed-msds.pdf");
    markDocumentNeedsReview(db, documentId, "official_regulatory_hit");
    expect(readDocumentLifecycle(db, documentId)).toMatchObject({
      fileName: "renamed-msds.pdf",
      reviewState: "needs_review",
      reviewReason: "official_regulatory_hit"
    });
    expect(readDocumentLifecycle(db, documentId).reviewRequiredAt).not.toBe("");

    approveDocumentAfterReplacement(db, documentId);
    expect(readDocumentLifecycle(db, documentId)).toMatchObject({
      reviewState: "approved",
      reviewReason: "",
      reviewRequiredAt: ""
    });
    expect(readDocumentLifecycle(db, documentId).reviewCompletedAt).not.toBe("");
    expect(readDocumentLifecycle(db, documentId).replacementUploadedAt).not.toBe("");
  });
});

function insertLifecycleDocument(db: Database.Database) {
  return insertDocument(db, {
    documentId: "doc-life",
    fileName: "sample.pdf",
    fileHash: "hash",
    storagePath: "doc-life/sample.pdf",
    status: "uploaded"
  });
}

function readDocumentLifecycle(db: Database.Database, documentId: string) {
  return db.prepare(`
    SELECT
      file_name AS fileName,
      review_state AS reviewState,
      review_reason AS reviewReason,
      review_required_at AS reviewRequiredAt,
      review_completed_at AS reviewCompletedAt,
      replacement_uploaded_at AS replacementUploadedAt
    FROM documents
    WHERE document_id = ?
  `).get(documentId) as {
    fileName: string;
    reviewState: string;
    reviewReason: string;
    reviewRequiredAt: string;
    reviewCompletedAt: string;
    replacementUploadedAt: string;
  };
}
