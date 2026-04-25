import { AlertTriangle, BellRing, Database, FileText } from "lucide-react";
import type { DocumentSummary, ReviewQueueItem } from "../../shared/types";

interface DashboardPageProps {
  documents: DocumentSummary[];
  queueItems: ReviewQueueItem[];
  onNavigate: (page: string) => void;
}

export function DashboardPage({ documents, queueItems, onNavigate }: DashboardPageProps) {
  const pendingAttentionCount = queueItems.filter((item) => item.reviewStatus === "needs_review").length;
  const componentCount = documents.reduce((sum, doc) => sum + doc.componentCount, 0);
  const monitoredDocumentCount = documents.filter((doc) => doc.componentCount > 0 && doc.queueCount === 0).length;
  const cards = [
    { label: "문서", value: documents.length, icon: FileText, page: "review" },
    { label: "확인 필요", value: pendingAttentionCount, icon: AlertTriangle, page: "queues" },
    { label: "성분 후보", value: componentCount, icon: Database, page: "watchlist" },
    { label: "감시 대상", value: monitoredDocumentCount, icon: BellRing, page: "watchlist" }
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
                <span>{document.uploadedAt.slice(0, 10)} · 성분 {document.componentCount} · 확인 {document.queueCount}</span>
              </div>
              <code>{displayDocumentState(document)}</code>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function displayDocumentState(document: DocumentSummary) {
  if (document.queueCount > 0) return "확인 필요";
  if (document.componentCount > 0) return "감시 대상";
  return "분석 필요";
}
