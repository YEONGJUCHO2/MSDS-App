export type ReviewStatus = "needs_review" | "approved" | "edited" | "excluded";
export type AiReviewStatus = "not_reviewed" | "ai_candidate" | "ai_needs_attention";
export type RegulatoryMatchStatus = "not_checked" | "internal_seed_matched" | "official_api_matched" | "api_key_required" | "no_match";

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
  aiReviewStatus?: AiReviewStatus;
  aiReviewNote?: string;
  regulatoryMatchStatus?: RegulatoryMatchStatus;
  regulatoryMatches?: RegulatoryMatch[];
}

export interface RegulatoryMatch {
  matchId: string;
  rowId: string;
  documentId: string;
  casNo: string;
  category: string;
  status: string;
  sourceType: "internal_seed" | "official_api";
  sourceName: string;
  sourceUrl: string;
  evidenceText: string;
  checkedAt: string;
}

export interface RegulatoryRecheckResult {
  rowId: string;
  seedMatches: number;
  apiMatches: number;
  status: RegulatoryMatchStatus;
}

export interface ApiProviderStatus {
  provider: "keco" | "kosha";
  label: string;
  configured: boolean;
  cacheCount: number;
}

export interface ProductSummary {
  productId: string;
  documentId: string;
  documentFileName: string;
  productName: string;
  supplier: string;
  manufacturer: string;
  siteNames: string;
  registrationStatus: string;
}

export interface WatchlistItem {
  watchId: string;
  casNo: string;
  chemicalName: string;
  lastSourceName: string;
  lastCheckedAt: string;
  status: RegulatoryMatchStatus | string;
}

export interface WatchlistRecheckResult {
  watchId: string;
  casNo: string;
  chemicalName: string;
  seedMatches: number;
  apiMatches: number;
  status: RegulatoryMatchStatus;
  sourceName: string;
  checkedAt: string;
  changed: boolean;
}

export interface ReviewQueueItem {
  queueId: string;
  documentId: string;
  entityId?: string;
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
