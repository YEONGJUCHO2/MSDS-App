import { AlertTriangle, ClipboardCheck, Database, FileText } from "lucide-react";
import type { DocumentSummary, ReviewQueueItem } from "../../shared/types";

interface DashboardPageProps {
  documents: DocumentSummary[];
  queueItems: ReviewQueueItem[];
  onNavigate: (page: string) => void;
}

export function DashboardPage({ documents, queueItems, onNavigate }: DashboardPageProps) {
  const cards = [
    { label: "문서", value: documents.length, icon: FileText, page: "review" },
    { label: "검수필요", value: queueItems.filter((item) => item.reviewStatus === "needs_review").length, icon: AlertTriangle, page: "queues" },
    { label: "성분 후보", value: documents.reduce((sum, doc) => sum + doc.componentCount, 0), icon: Database, page: "watchlist" },
    { label: "등록완료 대기", value: documents.filter((doc) => doc.status === "needs_review").length, icon: ClipboardCheck, page: "products" }
  ];

  return (
    <main className="page-grid">
      {cards.map((card) => (
        <button className="metric" key={card.label} onClick={() => onNavigate(card.page)} type="button">
          <card.icon aria-hidden="true" />
          <span>{card.label}</span>
          <strong>{card.value}</strong>
        </button>
      ))}
      <section className="panel wide">
        <div className="panel-title">
          <h2>최근 MSDS</h2>
          <button type="button" onClick={() => onNavigate("upload")}>업로드</button>
        </div>
        <div className="document-list">
          {documents.map((document) => (
            <div className="document-row" key={document.documentId}>
              <div>
                <strong>{document.fileName}</strong>
                <span>{document.uploadedAt.slice(0, 10)} · 성분 {document.componentCount} · 큐 {document.queueCount}</span>
              </div>
              <code>{document.status}</code>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
