import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
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
});
