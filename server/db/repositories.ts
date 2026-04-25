import type Database from "better-sqlite3";
import { nanoid } from "nanoid";
import type { DocumentSummary, Section3Row } from "../../shared/types";

export function insertDocument(
  db: Database.Database,
  input: { documentId?: string; fileName: string; fileHash: string; storagePath: string; status: string; textContent?: string; pageCount?: number }
) {
  const documentId = input.documentId ?? nanoid();
  db.prepare(`
    INSERT INTO documents (document_id, file_name, file_hash, storage_path, status, uploaded_at, text_content, page_count)
    VALUES (@documentId, @fileName, @fileHash, @storagePath, @status, @uploadedAt, @textContent, @pageCount)
  `).run({
    documentId,
    fileName: input.fileName,
    fileHash: input.fileHash,
    storagePath: input.storagePath,
    status: input.status,
    uploadedAt: new Date().toISOString(),
    textContent: input.textContent ?? "",
    pageCount: input.pageCount ?? 0
  });
  return documentId;
}

export function upsertDocumentText(db: Database.Database, documentId: string, textContent: string, pageCount: number, status: string) {
  db.prepare("UPDATE documents SET text_content = @textContent, page_count = @pageCount, status = @status WHERE document_id = @documentId").run({
    documentId,
    textContent,
    pageCount,
    status
  });
}

export function insertComponentRows(db: Database.Database, documentId: string, rows: Section3Row[]) {
  const insert = db.prepare(`
    INSERT INTO components (
      row_id, document_id, row_index, raw_row_text, cas_no_candidate, chemical_name_candidate,
      content_min_candidate, content_max_candidate, content_single_candidate, content_text,
      confidence, evidence_location, review_status
    ) VALUES (
      @rowId, @documentId, @rowIndex, @rawRowText, @casNoCandidate, @chemicalNameCandidate,
      @contentMinCandidate, @contentMaxCandidate, @contentSingleCandidate, @contentText,
      @confidence, @evidenceLocation, @reviewStatus
    )
  `);

  const insertQueue = db.prepare(`
    INSERT INTO review_queue (queue_id, document_id, field_type, label, candidate_value, evidence, review_status, created_at)
    VALUES (@queueId, @documentId, 'component', @label, @candidateValue, @evidence, @reviewStatus, @createdAt)
  `);

  const transaction = db.transaction(() => {
    for (const row of rows) {
      const rowId = row.rowId ?? nanoid();
      insert.run({ ...row, rowId, documentId });
      insertQueue.run({
        queueId: nanoid(),
        documentId,
        label: `${row.chemicalNameCandidate || "성분"} / ${row.casNoCandidate || "CAS 확인 필요"}`,
        candidateValue: row.contentText,
        evidence: `${row.evidenceLocation}: ${row.rawRowText}`,
        reviewStatus: row.reviewStatus,
        createdAt: new Date().toISOString()
      });
    }
  });

  transaction();
}

export function listDocuments(db: Database.Database): DocumentSummary[] {
  return db.prepare(`
    SELECT
      d.document_id AS documentId,
      d.file_name AS fileName,
      d.status AS status,
      d.uploaded_at AS uploadedAt,
      COUNT(DISTINCT c.row_id) AS componentCount,
      COUNT(DISTINCT q.queue_id) AS queueCount
    FROM documents d
    LEFT JOIN components c ON c.document_id = d.document_id
    LEFT JOIN review_queue q ON q.document_id = d.document_id AND q.review_status = 'needs_review'
    GROUP BY d.document_id
    ORDER BY d.uploaded_at DESC
  `).all() as DocumentSummary[];
}

export function listReviewQueue(db: Database.Database) {
  return db.prepare(`
    SELECT
      queue_id AS queueId,
      document_id AS documentId,
      field_type AS fieldType,
      label,
      candidate_value AS candidateValue,
      evidence,
      review_status AS reviewStatus,
      created_at AS createdAt
    FROM review_queue
    ORDER BY created_at DESC
  `).all();
}

export function listComponentRows(db: Database.Database, documentId: string): Section3Row[] {
  return db.prepare(`
    SELECT
      row_id AS rowId,
      row_index AS rowIndex,
      raw_row_text AS rawRowText,
      cas_no_candidate AS casNoCandidate,
      chemical_name_candidate AS chemicalNameCandidate,
      content_min_candidate AS contentMinCandidate,
      content_max_candidate AS contentMaxCandidate,
      content_single_candidate AS contentSingleCandidate,
      content_text AS contentText,
      confidence,
      evidence_location AS evidenceLocation,
      review_status AS reviewStatus
    FROM components
    WHERE document_id = ?
    ORDER BY row_index ASC
  `).all(documentId) as Section3Row[];
}
