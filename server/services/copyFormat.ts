import type { Section3Row } from "../../shared/types";
import { formatSingleComponentAsTsv } from "../../shared/componentExport";

export function formatComponentForClipboard(row: Section3Row) {
  return formatSingleComponentAsTsv(row);
}
