import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { createSqliteDocumentRepository } from "../../server/db/sqliteDocumentRepository";
import { migrate } from "../../server/db/schema";

describe("sqlite document repository", () => {
  it("creates, updates, and counts review data through the narrow repository boundary", () => {
    const db = new Database(":memory:");
    migrate(db);
    const repo = createSqliteDocumentRepository(db);

    const documentId = repo.insertDocument({
      documentId: "doc-1",
      fileName: "sample.pdf",
      fileHash: "hash",
      storagePath: "doc-1/sample.pdf",
      status: "uploaded"
    });

    repo.upsertDocumentText(documentId, "3. 구성성분", 1, "needs_review");

    expect(documentId).toBe("doc-1");
    expect(repo.findDocumentId(documentId)).toBe("doc-1");
    expect(repo.countNeedsReview(documentId)).toBe(0);
  });
});
