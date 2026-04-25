import type { AiReviewStatus, RegulatoryMatchStatus, ReviewStatus } from "./types";

export const reviewStatusLabels: Record<ReviewStatus, string> = {
  needs_review: "검수필요",
  approved: "확인",
  edited: "수정",
  excluded: "제외"
};

export const aiReviewStatusLabels: Record<AiReviewStatus, string> = {
  not_reviewed: "AI 미검토",
  ai_candidate: "AI 후보",
  ai_needs_attention: "AI 확인필요"
};

export const regulatoryMatchStatusLabels: Record<RegulatoryMatchStatus, string> = {
  not_checked: "DB 미조회",
  internal_seed_matched: "내부 기준 매칭",
  official_api_matched: "공식 API 조회",
  api_key_required: "API키 필요",
  no_match: "매칭 없음"
};
