import type { Section3Row } from "../../shared/types";
import { aiReviewStatusLabels, regulatoryMatchStatusLabels } from "../../shared/status";
import { StatusBadge } from "./StatusBadge";

export function ComponentTable({ rows }: { rows: Section3Row[] }) {
  return (
    <div className="table-shell">
      <table>
        <thead>
          <tr>
            <th>CAS No.</th>
            <th>화학물질</th>
            <th>MIN</th>
            <th>MAX</th>
            <th>단일</th>
            <th>근거</th>
            <th>AI</th>
            <th>DB</th>
            <th>상태</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.rowId}>
              <td>{row.casNoCandidate}</td>
              <td>{row.chemicalNameCandidate}</td>
              <td>{row.contentMinCandidate || "-"}</td>
              <td>{row.contentMaxCandidate || "-"}</td>
              <td>{row.contentSingleCandidate || "-"}</td>
              <td>{row.evidenceLocation}</td>
              <td>{row.aiReviewStatus ? aiReviewStatusLabels[row.aiReviewStatus] : "-"}</td>
              <td>{row.regulatoryMatchStatus ? regulatoryMatchStatusLabels[row.regulatoryMatchStatus] : "-"}</td>
              <td><StatusBadge status={row.reviewStatus} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
