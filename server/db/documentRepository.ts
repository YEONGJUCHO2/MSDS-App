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
  findDocumentId(documentId: string): Promise<string | undefined>;
  insertDocument(input: DocumentInsertInput): Promise<string>;
  upsertDocumentText(documentId: string, textContent: string, pageCount: number, status: string): Promise<void>;
  insertComponentRows(documentId: string, rows: Section3Row[]): Promise<void>;
  countNeedsReview(documentId: string): Promise<number>;
}
