import type { Section3Row } from "../../shared/types";
import { FieldRow } from "./FieldRow";
import { StatusBadge } from "./StatusBadge";

interface ComponentReviewPanelProps {
  rows: Array<Pick<Section3Row, "rowId" | "casNoCandidate" | "chemicalNameCandidate" | "contentText" | "evidenceLocation" | "reviewStatus">>;
}

export function ComponentReviewPanel({ rows }: ComponentReviewPanelProps) {
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
              <StatusBadge status={row.reviewStatus} />
            </header>
            <FieldRow label="CAS No." value={row.casNoCandidate} />
            <FieldRow label="함유량" value={row.contentText} />
          </article>
        ))}
      </div>
    </section>
  );
}
