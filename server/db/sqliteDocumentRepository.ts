import type Database from "better-sqlite3";
import type { DocumentInsertInput, DocumentRepository } from "./documentRepository";
import { insertComponentRows, insertDocument, upsertDocumentText } from "./repositories";

export function createSqliteDocumentRepository(db: Database.Database): DocumentRepository {
  return {
    findDocumentId(documentId) {
      const row = db.prepare("SELECT document_id AS documentId FROM documents WHERE document_id = ?").get(documentId) as { documentId: string } | undefined;
      return row?.documentId;
    },

    insertDocument(input: DocumentInsertInput) {
      return insertDocument(db, input);
    },

    upsertDocumentText(documentId, textContent, pageCount, status) {
      upsertDocumentText(db, documentId, textContent, pageCount, status);
    },

    insertComponentRows(documentId, rows) {
      insertComponentRows(db, documentId, rows);
    },

    countNeedsReview(documentId) {
      const row = db.prepare(`
        SELECT COUNT(*) AS count
        FROM review_queue
        WHERE document_id = ?
          AND review_status = 'needs_review'
      `).get(documentId) as { count: number };
      return row.count;
    }
  };
}
