import type Database from "better-sqlite3";
import { insertComponentRows, insertDocument, upsertDocumentText } from "../db/repositories";
import { classifyPdfTextLayer } from "./scanDetector";
import { extractSection3Rows } from "./tableExtractor";

export function processExtractedText(
  db: Database.Database,
  input: { documentId?: string; fileName: string; fileHash?: string; storagePath?: string; text: string; pageCount: number }
) {
  const existingDocument = input.documentId
    ? (db.prepare("SELECT document_id FROM documents WHERE document_id = ?").get(input.documentId) as { document_id: string } | undefined)
    : undefined;

  const documentId = input.documentId ?? "";
  const activeDocumentId =
    existingDocument?.document_id ??
    insertDocument(db, {
      documentId: documentId || undefined,
      fileName: input.fileName,
      fileHash: input.fileHash ?? "",
      storagePath: input.storagePath ?? "",
      status: "uploaded"
    });

  const classification = classifyPdfTextLayer(input.text, input.pageCount);
  upsertDocumentText(db, activeDocumentId, input.text, input.pageCount, classification.status);

  if (classification.needsOcr) {
    return {
      documentId: activeDocumentId,
      status: "manual_input_required" as const,
      componentRows: [],
      message: classification.reason
    };
  }

  const componentRows = extractSection3Rows(input.text);
  insertComponentRows(db, activeDocumentId, componentRows);
  upsertDocumentText(db, activeDocumentId, input.text, input.pageCount, "needs_review");

  return {
    documentId: activeDocumentId,
    status: "needs_review" as const,
    componentRows,
    message: `${componentRows.length}개 성분 후보를 검수 큐에 등록했습니다.`
  };
}
