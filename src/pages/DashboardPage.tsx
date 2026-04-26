import { AlertTriangle, BellRing, Database, FileText } from "lucide-react";
import type { DocumentSummary, ReviewQueueItem } from "../../shared/types";

interface DashboardPageProps {
  documents: DocumentSummary[];
  queueItems: ReviewQueueItem[];
  onDeleteDocument: (documentId: string) => void;
  onNavigate: (page: string) => void;
}

export function DashboardPage({ documents, queueItems, onDeleteDocument, onNavigate }: DashboardPageProps) {
  const pendingAttentionCount = queueItems.filter((item) => item.reviewStatus === "needs_review").length;
  const componentCount = documents.reduce((sum, doc) => sum + doc.componentCount, 0);
  const revisionNeededCount = 0;
  const cards = [
    { label: "등록된 MSDS", value: documents.length, icon: FileText, page: "review" },
    { label: "검수 필요", value: pendingAttentionCount, icon: AlertTriangle, page: "queues" },
    { label: "등록된 화학물질", value: componentCount, icon: Database, page: "watchlist" },
    { label: "개정 필요", value: revisionNeededCount, icon: BellRing, page: "revisions" }
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
                <span>{document.uploadedAt.slice(0, 10)} · 화학물질 {document.componentCount} · 검수 {document.queueCount}</span>
              </div>
              <div className="document-row-actions">
                <code>{displayDocumentState(document)}</code>
                <button aria-label={`${document.fileName} 삭제`} onClick={() => onDeleteDocument(document.documentId)} type="button">삭제</button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function displayDocumentState(document: DocumentSummary) {
  if (document.queueCount > 0) return "검수 필요";
  if (document.componentCount > 0) return "등록됨";
  return "분석 필요";
}
