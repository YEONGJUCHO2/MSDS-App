import { reviewStatusLabels } from "../../shared/status";
import type { ReviewStatus } from "../../shared/types";

interface StatusBadgeProps {
  status: ReviewStatus | string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const label = reviewStatusLabels[status as ReviewStatus] ?? status;
  return <span className={`status status-${status}`}>{label}</span>;
}
