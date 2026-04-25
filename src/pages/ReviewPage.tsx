import { useEffect, useState } from "react";
import type { DocumentSummary, Section3Row } from "../../shared/types";
import { api } from "../api/client";
import { ComponentReviewPanel } from "../components/ComponentReviewPanel";
import { ComponentTable } from "../components/ComponentTable";

export function ReviewPage({ documents }: { documents: DocumentSummary[] }) {
  const [selectedId, setSelectedId] = useState(documents[0]?.documentId ?? "");
  const [rows, setRows] = useState<Section3Row[]>([]);

  useEffect(() => {
    if (!selectedId) return;
    void api.components(selectedId).then((result) => setRows(result.rows));
  }, [selectedId]);

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
        <ComponentReviewPanel rows={rows} />
        <ComponentTable rows={rows} />
      </div>
    </main>
  );
}
