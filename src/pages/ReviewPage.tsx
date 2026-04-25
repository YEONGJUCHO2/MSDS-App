import { useEffect, useState } from "react";
import type { DocumentSummary, Section3Row } from "../../shared/types";
import { api } from "../api/client";
import { ComponentReviewPanel } from "../components/ComponentReviewPanel";
import { ComponentTable } from "../components/ComponentTable";

export function ReviewPage({ documents, onDataChanged }: { documents: DocumentSummary[]; onDataChanged?: () => void | Promise<void> }) {
  const [selectedId, setSelectedId] = useState(documents[0]?.documentId ?? "");
  const [rows, setRows] = useState<Section3Row[]>([]);
  const [recheckingRowId, setRecheckingRowId] = useState("");
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
    try {
      const result = await api.recheckComponent(selectedId, rowId);
      setRows(result.rows);
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
          recheckingRowId={recheckingRowId}
          updatingReviewRowId={updatingReviewRowId}
        />
        <ComponentTable rows={rows} />
      </div>
    </main>
  );
}
