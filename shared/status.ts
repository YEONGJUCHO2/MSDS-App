import type { ReviewStatus } from "./types";

export const reviewStatusLabels: Record<ReviewStatus, string> = {
  needs_review: "검수필요",
  approved: "확인",
  edited: "수정",
  excluded: "제외"
};
