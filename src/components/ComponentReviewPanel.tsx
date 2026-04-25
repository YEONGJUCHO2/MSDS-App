import type { Section3Row } from "../../shared/types";
import { aiReviewStatusLabels, regulatoryMatchStatusLabels } from "../../shared/status";

interface ComponentReviewPanelProps {
  rows: Array<Pick<Section3Row, "rowId" | "casNoCandidate" | "chemicalNameCandidate" | "contentText" | "evidenceLocation" | "reviewStatus" | "aiReviewStatus" | "aiReviewNote" | "regulatoryMatchStatus" | "regulatoryMatches">>;
  onRecheck?: (rowId: string) => void;
  recheckMessages?: Record<string, string>;
  recheckingRowId?: string;
}

export function ComponentReviewPanel({ rows, onRecheck, recheckMessages = {}, recheckingRowId }: ComponentReviewPanelProps) {
  if (rows.length === 0) {
    return <div className="empty">성분 후보가 없습니다. 스캔본이면 OCR 또는 수동입력 큐로 보내야 합니다.</div>;
  }

  return (
    <section className="panel">
      <div className="panel-title">
        <h2>성분 검수</h2>
        <span>{rows.length}개 후보</span>
      </div>
      <div className="table-shell">
        <table className="component-review-table">
          <thead>
            <tr>
              <th>화학물질</th>
              <th>CAS No.</th>
              <th>함유량</th>
              <th>공식/기준 조회</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const regulatoryEvidence = (row.regulatoryMatches ?? []).map((match) => `${match.sourceName}: ${match.evidenceText || match.category}`).join(" / ");
              const regulatorySources = Array.from(new Set((row.regulatoryMatches ?? []).map((match) => match.sourceName))).join(", ");
              const rowKey = row.rowId ?? `${row.casNoCandidate}-${row.evidenceLocation}`;

              return (
                <tr key={rowKey}>
                  <td>{row.chemicalNameCandidate || "성분명 확인필요"}</td>
                  <td>{row.casNoCandidate || "CAS 확인필요"}</td>
                  <td>{row.contentText || "함유량 확인필요"}</td>
                  <td title={regulatoryEvidence || row.aiReviewNote}>
                    {row.regulatoryMatchStatus ? regulatoryMatchStatusLabels[row.regulatoryMatchStatus] : "DB 미조회"}
                    {row.aiReviewStatus ? <span className="table-subtext">{aiReviewStatusLabels[row.aiReviewStatus]}</span> : null}
                    {regulatorySources ? <span className="table-subtext">{regulatorySources}</span> : null}
                    {row.evidenceLocation ? <span className="table-subtext">{row.evidenceLocation}</span> : null}
                    {row.rowId && recheckMessages[row.rowId] ? <span className="lookup-feedback compact">{recheckMessages[row.rowId]}</span> : null}
                    {row.rowId && onRecheck ? (
                      <button className="table-action" disabled={recheckingRowId === row.rowId} onClick={() => onRecheck(row.rowId!)} type="button">
                        {recheckingRowId === row.rowId ? "조회중" : "공식조회"}
                      </button>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
