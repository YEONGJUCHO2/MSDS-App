import type { Section3Row } from "../../shared/types";

export function formatComponentForClipboard(row: Section3Row) {
  return [row.casNoCandidate, row.chemicalNameCandidate, row.contentMinCandidate, row.contentMaxCandidate, row.contentSingleCandidate]
    .map((value) => value || "-")
    .join("\t");
}
