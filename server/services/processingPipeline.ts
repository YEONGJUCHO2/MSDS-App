import type Database from "better-sqlite3";
import { nanoid } from "nanoid";
import type { DocumentRepository } from "../db/documentRepository";
import { createSqliteDocumentRepository } from "../db/sqliteDocumentRepository";
import { reviewComponentRowsWithOptionalCodex } from "./aiReviewer";
import { matchAndStoreRegulatoryData } from "./regulatoryMatcher";
import { classifyPdfTextLayer } from "./scanDetector";
import { extractSection3Rows } from "./tableExtractor";

type ProcessExtractedTextInput = {
  documentId?: string;
  fileName: string;
  fileHash?: string;
  storagePath?: string;
  text: string;
  pageCount: number;
};

export async function processExtractedText(
  db: Database.Database,
  input: ProcessExtractedTextInput
) {
  return processExtractedTextWithRepository(db, createSqliteDocumentRepository(db), input);
}

export async function processExtractedTextWithRepository(
  db: Database.Database,
  repo: DocumentRepository,
  input: ProcessExtractedTextInput
) {
  const existingDocumentId = input.documentId ? await repo.findDocumentId(input.documentId) : undefined;

  const documentId = input.documentId ?? "";
  const activeDocumentId =
    existingDocumentId ??
    await repo.insertDocument({
      documentId: documentId || undefined,
      fileName: input.fileName,
      fileHash: input.fileHash ?? "",
      storagePath: input.storagePath ?? "",
      status: "uploaded"
    });

  const classification = classifyPdfTextLayer(input.text, input.pageCount);
  await repo.upsertDocumentText(activeDocumentId, input.text, input.pageCount, classification.status);

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

  if (componentRows.length === 0) {
    await repo.upsertDocumentText(activeDocumentId, input.text, input.pageCount, "manual_input_required");
    return {
      documentId: activeDocumentId,
      status: "manual_input_required" as const,
      componentRows,
      message: "성분 후보를 자동 추출하지 못했습니다. PDF 텍스트/표 구조를 확인하거나 수동 입력이 필요합니다."
    };
  }

  await repo.insertComponentRows(activeDocumentId, componentRows);
  await matchAndStoreRegulatoryData(db, activeDocumentId, componentRows);
  await repo.upsertDocumentText(activeDocumentId, input.text, input.pageCount, "needs_review");
  const queueCount = await repo.countNeedsReview(activeDocumentId);

  return {
    documentId: activeDocumentId,
    status: "needs_review" as const,
    componentRows,
    message: queueCount > 0
      ? `${componentRows.length}개 성분 후보를 추출했고, 확인이 필요한 ${queueCount}개 항목을 큐에 등록했습니다.`
      : `${componentRows.length}개 성분 후보를 사내 입력 포맷에 반영했습니다. 추가 확인이 필요한 항목은 없습니다.`
  };
}
