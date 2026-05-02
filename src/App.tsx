import { ClipboardList, Database, Gauge, ListChecks, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import type { DocumentSummary, ReviewQueueItem } from "../shared/types";
import { api } from "./api/client";
import { useUploadTask } from "./hooks/useUploadTask";
import { DashboardPage } from "./pages/DashboardPage";
import { ProductsPage } from "./pages/ProductsPage";
import { ReviewPage } from "./pages/ReviewPage";
import { SchedulesPage } from "./pages/SchedulesPage";
import { UploadPage, UploadTaskFeedback } from "./pages/UploadPage";
import { WatchlistPage } from "./pages/WatchlistPage";

const navItems = [
  { id: "dashboard", label: "대시보드", icon: Gauge },
  { id: "upload", label: "업로드", icon: Upload },
  { id: "review", label: "MSDS", icon: ClipboardList },
  { id: "queues", label: "물질정보", icon: ListChecks },
  { id: "products", label: "현장관리", icon: Database }
];

export default function App() {
  const [page, setPage] = useState("dashboard");
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [queueItems, setQueueItems] = useState<ReviewQueueItem[]>([]);
  const [selectedReviewDocumentId, setSelectedReviewDocumentId] = useState("");
  const upload = useUploadTask(() => void refresh());

  async function refresh() {
    const [documentResult, queueResult] = await Promise.all([api.documents(), api.queues()]);
    setDocuments(documentResult.documents);
    setQueueItems(queueResult.items);
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function handleDeleteDocument(documentId: string) {
    const document = documents.find((item) => item.documentId === documentId);
    const label = document?.fileName ?? "선택한 MSDS";
    if (!window.confirm(`${label} 문서를 삭제할까요? 성분, 검수 큐, 기본정보, 업로드 파일이 함께 삭제됩니다.`)) return;
    const result = await api.deleteDocument(documentId);
    setDocuments(result.documents);
    const queueResult = await api.queues();
    setQueueItems(queueResult.items);
  }

  async function handleDeleteDocuments(documentIds: string[]) {
    if (documentIds.length === 0) return;
    const documentNames = documents
      .filter((item) => documentIds.includes(item.documentId))
      .map((item) => item.fileName);
    const label = documentNames.length > 0 ? `${documentNames.length}개 MSDS` : "선택한 MSDS";
    if (!window.confirm(`${label} 문서를 삭제할까요? 성분, 검수 큐, 기본정보, 업로드 파일이 함께 삭제됩니다.`)) return;
    for (const documentId of documentIds) {
      await api.deleteDocument(documentId);
    }
    await refresh();
  }

  function openDocumentInReview(documentId: string) {
    setSelectedReviewDocumentId(documentId);
    setPage("review");
  }

  async function handleRecheckDocuments(documentIds: string[]) {
    const result = await api.recheckDocuments(documentIds);
    await refresh();
    return result;
  }

  async function handleRenameDocument(documentId: string, fileName: string) {
    const result = await api.renameDocument(documentId, fileName);
    setDocuments(result.documents);
  }

  async function handleUploadReplacement(documentId: string, file: File) {
    const result = await api.uploadReplacement(documentId, file);
    setDocuments(result.documents);
    const queueResult = await api.queues();
    setQueueItems(queueResult.items);
  }

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
        {page !== "upload" && (upload.task.busy || upload.task.message) ? (
          <div className="global-upload-status">
            <UploadTaskFeedback task={upload.task} />
          </div>
        ) : null}
        {page === "dashboard" ? (
          <DashboardPage
            documents={documents}
            queueItems={queueItems}
            onDeleteDocument={(documentId) => void handleDeleteDocument(documentId)}
            onDeleteDocuments={(documentIds) => void handleDeleteDocuments(documentIds)}
            onNavigate={setPage}
            onOpenDocument={openDocumentInReview}
            onRenameDocument={(documentId, fileName) => void handleRenameDocument(documentId, fileName)}
            onRecheckDocuments={handleRecheckDocuments}
            onUploadReplacement={(documentId, file) => void handleUploadReplacement(documentId, file)}
          />
        ) : null}
        {page === "upload" ? <UploadPage uploadTask={upload.task} onFilesSelected={upload.startUpload} /> : null}
        {page === "review" ? (
          <ReviewPage
            documents={documents}
            selectedDocumentId={selectedReviewDocumentId}
            onDeleteDocument={(documentId) => void handleDeleteDocument(documentId)}
            onDeleteDocuments={(documentIds) => void handleDeleteDocuments(documentIds)}
            onDocumentsRechecked={refresh}
            onRenameDocument={(documentId, fileName) => void handleRenameDocument(documentId, fileName)}
            onUploadReplacement={(documentId, file) => void handleUploadReplacement(documentId, file)}
          />
        ) : null}
        {page === "queues" ? <WatchlistPage /> : null}
        {page === "products" ? <ProductsPage /> : null}
        {page === "schedules" ? <SchedulesPage /> : null}
        {page === "watchlist" ? <WatchlistPage /> : null}
      </div>
    </div>
  );
}
