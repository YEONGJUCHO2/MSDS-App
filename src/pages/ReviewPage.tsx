import { useEffect, useState } from "react";
import type { DocumentSummary, RegulatoryRecheckResult, Section3Row } from "../../shared/types";
import { api } from "../api/client";
import { ComponentReviewPanel } from "../components/ComponentReviewPanel";
import { ComponentTable } from "../components/ComponentTable";

export function ReviewPage({ documents, onDataChanged }: { documents: DocumentSummary[]; onDataChanged?: () => void | Promise<void> }) {
  const [selectedId, setSelectedId] = useState(documents[0]?.documentId ?? "");
  const [rows, setRows] = useState<Section3Row[]>([]);
  const [recheckingRowId, setRecheckingRowId] = useState("");
  const [recheckMessages, setRecheckMessages] = useState<Record<string, string>>({});
  const [updatingReviewRowId, setUpdatingReviewRowId] = useState("");

  useEffect(() => {
    if (!selectedId) return;
    void api.components(selectedId).then((result) => setRows(result.rows));
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId && documents[0]?.documentId) {
      setSelectedId(documents[0].documentId);
    }
  }, [documents, selectedId]);

  async function handleRecheck(rowId: string) {
    if (!selectedId) return;
    setRecheckingRowId(rowId);
    setRecheckMessages((current) => ({ ...current, [rowId]: "공식조회 요청 중입니다." }));
    try {
      const result = await api.recheckComponent(selectedId, rowId);
      setRows(result.rows);
      setRecheckMessages((current) => ({ ...current, [rowId]: describeRecheckResult(result.result) }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "알 수 없는 오류";
      setRecheckMessages((current) => ({ ...current, [rowId]: `공식조회 실패: ${message}` }));
    } finally {
      setRecheckingRowId("");
    }
  }

  async function handleReviewStatusChange(rowId: string, reviewStatus: "approved" | "excluded") {
    if (!selectedId) return;
    setUpdatingReviewRowId(rowId);
    try {
      const result = await api.reviewComponent(selectedId, rowId, reviewStatus);
      setRows(result.rows);
      await onDataChanged?.();
    } finally {
      setUpdatingReviewRowId("");
    }
  }

  return (
    <main className="review-layout">
      <aside className="sidebar-list">
        {documents.map((document) => (
          <button className={selectedId === document.documentId ? "selected" : ""} key={document.documentId} onClick={() => setSelectedId(document.documentId)} type="button">
            <strong>{document.fileName}</strong>
            <span>{document.status}</span>
          </button>
        ))}
      </aside>
      <div className="review-main">
        <ComponentReviewPanel
          rows={rows}
          onRecheck={handleRecheck}
          onReviewStatusChange={handleReviewStatusChange}
          recheckMessages={recheckMessages}
          recheckingRowId={recheckingRowId}
          updatingReviewRowId={updatingReviewRowId}
        />
        <ComponentTable rows={rows} />
      </div>
    </main>
  );
}

function describeRecheckResult(result: RegulatoryRecheckResult) {
  if (result.status === "api_key_required") {
    return "공식 API URL/키가 설정되지 않아 외부 조회는 실행되지 않았습니다.";
  }
  if (result.status === "official_api_matched") {
    return `공식 API 매칭 ${result.apiMatches}건을 반영했습니다.`;
  }
  if (result.status === "internal_seed_matched") {
    return `공식 API 매칭은 없고 내부 기준 ${result.seedMatches}건을 반영했습니다.`;
  }
  return "공식조회 완료: 매칭 없음.";
}
