export type ReviewStatus = "needs_review" | "approved" | "edited" | "excluded";

export type ProcessingStatus =
  | "uploaded"
  | "text_layer_detected"
  | "scan_detected"
  | "ocr_pending"
  | "ocr_completed"
  | "ocr_low_confidence"
  | "manual_input_required"
  | "needs_review"
  | "approved";

export type RegulatoryCandidateStatus =
  | "해당"
  | "비해당"
  | "해당 후보"
  | "비해당 후보"
  | "확인필요"
  | "공급사 확인 필요"
  | "내부 기준 확인 필요";

export interface Section3Row {
  rowId?: string;
  rowIndex: number;
  rawRowText: string;
  casNoCandidate: string;
  chemicalNameCandidate: string;
  contentMinCandidate: string;
  contentMaxCandidate: string;
  contentSingleCandidate: string;
  contentText: string;
  confidence: number;
  evidenceLocation: string;
  reviewStatus: ReviewStatus;
}

export interface ReviewQueueItem {
  queueId: string;
  documentId: string;
  fieldType: "document" | "component" | "regulatory" | "ocr";
  label: string;
  candidateValue: string;
  evidence: string;
  reviewStatus: ReviewStatus;
  createdAt: string;
}

export interface DocumentSummary {
  documentId: string;
  fileName: string;
  status: ProcessingStatus;
  uploadedAt: string;
  componentCount: number;
  queueCount: number;
}

export interface RegulatoryCandidate {
  category: string;
  casNo: string;
  chemicalNameKo: string;
  status: RegulatoryCandidateStatus;
  period: string;
  sourceName: string;
  sourceUrl: string;
}
