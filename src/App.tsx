import { ClipboardList, Database, FileDiff, Gauge, ListChecks, Upload, Watch } from "lucide-react";
import { useEffect, useState } from "react";
import type { DocumentSummary, ReviewQueueItem } from "../shared/types";
import { api } from "./api/client";
import { DashboardPage } from "./pages/DashboardPage";
import { ProductsPage } from "./pages/ProductsPage";
import { QueuesPage } from "./pages/QueuesPage";
import { ReviewPage } from "./pages/ReviewPage";
import { RevisionDiffPage } from "./pages/RevisionDiffPage";
import { SchedulesPage } from "./pages/SchedulesPage";
import { UploadPage } from "./pages/UploadPage";
import { WatchlistPage } from "./pages/WatchlistPage";

const navItems = [
  { id: "dashboard", label: "대시보드", icon: Gauge },
  { id: "upload", label: "업로드", icon: Upload },
  { id: "review", label: "검수", icon: ClipboardList },
  { id: "queues", label: "큐", icon: ListChecks },
  { id: "products", label: "관리", icon: Database },
  { id: "revisions", label: "개정", icon: FileDiff },
  { id: "watchlist", label: "감시", icon: Watch }
];

export default function App() {
  const [page, setPage] = useState("dashboard");
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [queueItems, setQueueItems] = useState<ReviewQueueItem[]>([]);

  async function refresh() {
    const [documentResult, queueResult] = await Promise.all([api.documents(), api.queues()]);
    setDocuments(documentResult.documents);
    setQueueItems(queueResult.items);
  }

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <div className="app-shell" data-testid="app-shell">
      <nav className="app-nav" data-testid="app-nav">
        <div className="brand">
          <strong>MSDS Watcher</strong>
          <span>local review console</span>
        </div>
        {navItems.map((item) => (
          <button className={page === item.id ? "active" : ""} key={item.id} onClick={() => setPage(item.id)} title={item.label} type="button">
            <item.icon aria-hidden="true" />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
      <div className="content" data-testid="app-content">
        {page === "dashboard" ? <DashboardPage documents={documents} queueItems={queueItems} onNavigate={setPage} /> : null}
        {page === "upload" ? <UploadPage onUploaded={() => void refresh()} /> : null}
        {page === "review" ? <ReviewPage documents={documents} /> : null}
        {page === "queues" ? <QueuesPage items={queueItems} /> : null}
        {page === "products" ? <ProductsPage /> : null}
        {page === "revisions" ? <RevisionDiffPage /> : null}
        {page === "schedules" ? <SchedulesPage /> : null}
        {page === "watchlist" ? <WatchlistPage /> : null}
      </div>
    </div>
  );
}
