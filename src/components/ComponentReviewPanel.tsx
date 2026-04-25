import type { ReviewStatus, Section3Row } from "../../shared/types";
import { FieldRow } from "./FieldRow";
import { StatusBadge } from "./StatusBadge";
import { aiReviewStatusLabels, regulatoryMatchStatusLabels } from "../../shared/status";

interface ComponentReviewPanelProps {
  rows: Array<Pick<Section3Row, "rowId" | "casNoCandidate" | "chemicalNameCandidate" | "contentText" | "evidenceLocation" | "reviewStatus" | "aiReviewStatus" | "aiReviewNote" | "regulatoryMatchStatus" | "regulatoryMatches">>;
  onRecheck?: (rowId: string) => void;
  onReviewStatusChange?: (rowId: string, reviewStatus: Extract<ReviewStatus, "approved" | "excluded">) => void;
  recheckingRowId?: string;
  updatingReviewRowId?: string;
}

export function ComponentReviewPanel({ rows, onRecheck, onReviewStatusChange, recheckingRowId, updatingReviewRowId }: ComponentReviewPanelProps) {
  if (rows.length === 0) {
    return <div className="empty">성분 후보가 없습니다. 스캔본이면 OCR 또는 수동입력 큐로 보내야 합니다.</div>;
  }

  return (
    <section className="panel">
      <div className="panel-title">
        <h2>성분 검수</h2>
        <span>{rows.length}개 후보</span>
      </div>
      <div className="component-list">
        {rows.map((row) => (
          <article className="component-item" key={row.rowId ?? `${row.casNoCandidate}-${row.evidenceLocation}`}>
            <header>
              <div>
                <strong>{row.chemicalNameCandidate || "성분명 확인필요"}</strong>
                <span>{row.evidenceLocation}</span>
              </div>
              <div className="component-actions">
                {row.rowId && onRecheck ? (
                  <button disabled={recheckingRowId === row.rowId} onClick={() => onRecheck(row.rowId!)} type="button">
                    {recheckingRowId === row.rowId ? "조회중" : "공식조회"}
                  </button>
                ) : null}
                <StatusBadge status={row.reviewStatus} />
              </div>
            </header>
            <FieldRow label="CAS No." value={row.casNoCandidate} />
            <FieldRow label="함유량" value={row.contentText} />
            <FieldRow label="AI 검토" value={row.aiReviewStatus ? aiReviewStatusLabels[row.aiReviewStatus] : "AI 미검토"} evidence={row.aiReviewNote} />
            <FieldRow
              label="DB 조회"
              value={row.regulatoryMatchStatus ? regulatoryMatchStatusLabels[row.regulatoryMatchStatus] : "DB 미조회"}
              evidence={(row.regulatoryMatches ?? []).map((match) => `${match.sourceName}: ${match.evidenceText || match.category}`).join(" / ")}
            />
            {row.rowId && onReviewStatusChange ? (
              <div className="review-actions">
                <button disabled={updatingReviewRowId === row.rowId} onClick={() => onReviewStatusChange(row.rowId!, "approved")} type="button">확인</button>
                <button disabled={updatingReviewRowId === row.rowId} onClick={() => onReviewStatusChange(row.rowId!, "excluded")} type="button">제외</button>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
