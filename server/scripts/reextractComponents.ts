import "../config/loadEnv";
import { getDb } from "../db/connection";
import { reviewComponentRows } from "../services/aiReviewer";
import { extractSection3Rows } from "../services/tableExtractor";

interface StoredDocument {
  documentId: string;
  fileName: string;
  textContent: string;
}

interface StoredComponent {
  rowId: string;
  rowIndex: number;
  reviewStatus: string;
}

const db = getDb();
const documents = db.prepare(`
  SELECT
    document_id AS documentId,
    file_name AS fileName,
    text_content AS textContent
  FROM documents
  WHERE text_content <> ''
  ORDER BY uploaded_at ASC
`).all() as StoredDocument[];

const componentsByDocument = db.prepare(`
  SELECT
    row_id AS rowId,
    row_index AS rowIndex,
    review_status AS reviewStatus
  FROM components
  WHERE document_id = ?
  ORDER BY row_index ASC
`);

const updateComponent = db.prepare(`
  UPDATE components
  SET
    raw_row_text = @rawRowText,
    cas_no_candidate = @casNoCandidate,
    chemical_name_candidate = @chemicalNameCandidate,
    content_min_candidate = @contentMinCandidate,
    content_max_candidate = @contentMaxCandidate,
    content_single_candidate = @contentSingleCandidate,
    content_text = @contentText,
    confidence = @confidence,
    evidence_location = @evidenceLocation,
    ai_review_status = @aiReviewStatus,
    ai_review_note = @aiReviewNote
  WHERE row_id = @rowId
`);

const updateQueue = db.prepare(`
  UPDATE review_queue
  SET
    label = @label,
    candidate_value = @candidateValue,
    evidence = @evidence
  WHERE entity_id = @rowId
`);

let updated = 0;
let skipped = 0;

const transaction = db.transaction((document: StoredDocument, storedRows: StoredComponent[]) => {
  const storedByIndex = new Map(storedRows.map((row) => [row.rowIndex, row]));
  const extractedRows = reviewComponentRows(extractSection3Rows(document.textContent));

  for (const row of extractedRows) {
    const storedRow = storedByIndex.get(row.rowIndex);
    if (!storedRow) {
      skipped += 1;
      continue;
    }

    updateComponent.run({
      ...row,
      rowId: storedRow.rowId,
      reviewStatus: storedRow.reviewStatus
    });
    updateQueue.run({
      rowId: storedRow.rowId,
      label: `${row.chemicalNameCandidate || "성분명 확인필요"} / ${row.casNoCandidate || "CAS 확인 필요"}`,
      candidateValue: row.contentText,
      evidence: `${row.evidenceLocation}: ${row.rawRowText}`
    });
    updated += 1;
  }
});

for (const document of documents) {
  const storedRows = componentsByDocument.all(document.documentId) as StoredComponent[];
  transaction(document, storedRows);
}

console.log(`Re-extracted ${updated} component rows from ${documents.length} documents. Skipped ${skipped} rows without an existing slot.`);
