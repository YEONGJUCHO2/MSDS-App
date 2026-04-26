import type { Section3Row } from "../../shared/types";

export interface DocumentInsertInput {
  documentId?: string;
  fileName: string;
  fileHash: string;
  storagePath: string;
  status: string;
  textContent?: string;
  pageCount?: number;
}

export interface DocumentRepository {
  findDocumentId(documentId: string): string | undefined;
  insertDocument(input: DocumentInsertInput): string;
  upsertDocumentText(documentId: string, textContent: string, pageCount: number, status: string): void;
  insertComponentRows(documentId: string, rows: Section3Row[]): void;
  countNeedsReview(documentId: string): number;
}
