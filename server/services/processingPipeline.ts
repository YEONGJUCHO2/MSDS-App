import type Database from "better-sqlite3";
import { nanoid } from "nanoid";
import { createSqliteDocumentRepository } from "../db/sqliteDocumentRepository";
import { reviewComponentRowsWithOptionalCodex } from "./aiReviewer";
import { matchAndStoreRegulatoryData } from "./regulatoryMatcher";
import { classifyPdfTextLayer } from "./scanDetector";
import { extractSection3Rows } from "./tableExtractor";

export async function processExtractedText(
  db: Database.Database,
  input: { documentId?: string; fileName: string; fileHash?: string; storagePath?: string; text: string; pageCount: number }
) {
  const repo = createSqliteDocumentRepository(db);
  const existingDocumentId = input.documentId ? repo.findDocumentId(input.documentId) : undefined;

  const documentId = input.documentId ?? "";
  const activeDocumentId =
    existingDocumentId ??
    repo.insertDocument({
      documentId: documentId || undefined,
      fileName: input.fileName,
      fileHash: input.fileHash ?? "",
      storagePath: input.storagePath ?? "",
      status: "uploaded"
    });

  const classification = classifyPdfTextLayer(input.text, input.pageCount);
  repo.upsertDocumentText(activeDocumentId, input.text, input.pageCount, classification.status);

  if (classification.needsOcr) {
    return {
      documentId: activeDocumentId,
      status: "manual_input_required" as const,
      componentRows: [],
      message: classification.reason
    };
  }

  const componentRows = (await reviewComponentRowsWithOptionalCodex(input.text, extractSection3Rows(input.text))).map((row) => ({
    ...row,
    rowId: row.rowId ?? nanoid()
  }));
  repo.insertComponentRows(activeDocumentId, componentRows);
  await matchAndStoreRegulatoryData(db, activeDocumentId, componentRows);
  repo.upsertDocumentText(activeDocumentId, input.text, input.pageCount, "needs_review");
  const queueCount = repo.countNeedsReview(activeDocumentId);

  return {
    documentId: activeDocumentId,
    status: "needs_review" as const,
    componentRows,
    message: queueCount > 0
      ? `${componentRows.length}개 성분 후보를 추출했고, 확인이 필요한 ${queueCount}개 항목을 큐에 등록했습니다.`
      : `${componentRows.length}개 성분 후보를 사내 입력 포맷에 반영했습니다. 추가 확인이 필요한 항목은 없습니다.`
  };
}
