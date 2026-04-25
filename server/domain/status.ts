import type { ReviewStatus } from "../../shared/types";
export { reviewStatusLabels } from "../../shared/status";

export function normalizeReviewStatus(value: string | null | undefined): ReviewStatus {
  if (value === "approved" || value === "edited" || value === "excluded") {
    return value;
  }
  return "needs_review";
}
