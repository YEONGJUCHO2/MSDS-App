import { AlertTriangle, BellRing, Database, FileText } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { DocumentSummary, ReviewQueueItem } from "../../shared/types";
import { api } from "../api/client";

const DOCUMENTS_PER_PAGE = 5;

interface DashboardPageProps {
  documents: DocumentSummary[];
  queueItems: ReviewQueueItem[];
  onDeleteDocument: (documentId: string) => void;
  onDeleteDocuments?: (documentIds: string[]) => void;
  onOpenDocument: (documentId: string) => void;
  onNavigate: (page: string) => void;
  onRecheckDocuments: (documentIds: string[]) => Promise<{ documentCount: number; rowCount: number }> | { documentCount: number; rowCount: number };
}

export function DashboardPage({ documents, queueItems, onDeleteDocument, onDeleteDocuments, onOpenDocument, onNavigate, onRecheckDocuments }: DashboardPageProps) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<Set<string>>(() => new Set());
  const [batchBusy, setBatchBusy] = useState(false);
  const [batchMessage, setBatchMessage] = useState("");
  const pendingAttentionCount = queueItems.filter((item) => item.reviewStatus === "needs_review").length;
  const componentCount = documents.reduce((sum, doc) => sum + doc.componentCount, 0);
  const revisionNeededCount = 0;
  const cards = [
    { label: "등록된 MSDS", value: documents.length, icon: FileText, page: "review" },
    { label: "검수 필요", value: pendingAttentionCount, icon: AlertTriangle, page: "review" },
    { label: "등록된 화학물질", value: componentCount, icon: Database, page: "watchlist" },
    { label: "개정 필요", value: revisionNeededCount, icon: BellRing, page: "revisions" }
  ];
  const filteredDocuments = useMemo(() => {
    const normalizedQuery = normalizeSearchText(query);
    if (!normalizedQuery) return documents;
    return documents.filter((document) => [
      document.fileName,
      displayDocumentState(document),
      document.uploadedAt.slice(0, 10),
      String(document.componentCount),
      String(document.queueCount)
    ].some((value) => normalizeSearchText(value).includes(normalizedQuery)));
  }, [documents, query]);
  const pageCount = Math.max(1, Math.ceil(filteredDocuments.length / DOCUMENTS_PER_PAGE));
  const pageDocuments = filteredDocuments.slice((page - 1) * DOCUMENTS_PER_PAGE, page * DOCUMENTS_PER_PAGE);
  const selectedCount = selectedDocumentIds.size;
  const visibleIds = pageDocuments.map((document) => document.documentId);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((documentId) => selectedDocumentIds.has(documentId));

  useEffect(() => {
    setPage(1);
  }, [query, documents]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  function toggleDocument(documentId: string) {
    setSelectedDocumentIds((current) => {
      const next = new Set(current);
      if (next.has(documentId)) {
        next.delete(documentId);
      } else {
        next.add(documentId);
      }
      return next;
    });
  }

  function toggleVisibleDocuments() {
    setSelectedDocumentIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected) {
        visibleIds.forEach((documentId) => next.delete(documentId));
      } else {
        visibleIds.forEach((documentId) => next.add(documentId));
      }
      return next;
    });
  }

  function handleSelectedDelete() {
    const documentIds = Array.from(selectedDocumentIds);
    if (onDeleteDocuments) {
      onDeleteDocuments(documentIds);
    } else {
      documentIds.forEach((documentId) => onDeleteDocument(documentId));
    }
    setSelectedDocumentIds(new Set());
  }

  function handleSelectedDownload() {
    Array.from(selectedDocumentIds).forEach((documentId) => {
      window.open(api.documentFileUrl(documentId), "_blank", "noopener,noreferrer");
    });
  }

  async function handleBatchRecheck() {
    const documentIds = Array.from(selectedDocumentIds);
    if (documentIds.length === 0) return;
    setBatchBusy(true);
    setBatchMessage("선택한 MSDS 조회/재조회 중입니다.");
    try {
      const result = await onRecheckDocuments(documentIds);
      setBatchMessage(`${result.documentCount}개 MSDS · ${result.rowCount}개 성분 조회/재조회 완료`);
    } catch (error) {
      setBatchMessage(error instanceof Error ? `조회/재조회 실패: ${error.message}` : "조회/재조회 실패");
    } finally {
      setBatchBusy(false);
    }
  }

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
          <label className="dashboard-search">
            <span>MSDS 검색</span>
            <input
              placeholder="파일명, 상태, 날짜로 MSDS 검색"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <button disabled={batchBusy || selectedCount === 0} onClick={() => void handleBatchRecheck()} type="button">선택 조회/재조회</button>
          <button disabled={selectedCount === 0} onClick={handleSelectedDownload} type="button">선택 첨부 다운로드</button>
          <button disabled={selectedCount === 0} onClick={handleSelectedDelete} type="button">선택항목 삭제</button>
          <button type="button" onClick={() => onNavigate("upload")}>업로드</button>
        </div>
        <div className="document-list-controls">
          <label>
            <input checked={allVisibleSelected} disabled={pageDocuments.length === 0} onChange={toggleVisibleDocuments} type="checkbox" />
            현재 페이지 MSDS 전체 선택
          </label>
          <span>{selectedCount}개 선택</span>
        </div>
        {batchMessage ? <p className="lookup-feedback compact">{batchMessage}</p> : null}
        <div className="document-slot-table">
          <table>
            <thead>
              <tr>
                <th scope="col">체크표시</th>
                <th scope="col">번호</th>
                <th scope="col">파일명</th>
                <th scope="col">등록일자</th>
                <th scope="col">상태</th>
                <th scope="col">첨부파일</th>
                <th scope="col">삭제</th>
              </tr>
            </thead>
            <tbody>
          {filteredDocuments.length === 0 ? (
            <tr>
              <td className="empty compact" colSpan={7}>검색 결과가 없습니다.</td>
            </tr>
          ) : null}
          {pageDocuments.map((document, index) => (
            <tr key={document.documentId}>
              <td>
                <label className="document-select">
                  <input checked={selectedDocumentIds.has(document.documentId)} onChange={() => toggleDocument(document.documentId)} type="checkbox" />
                  <span className="sr-only">{document.fileName} 선택</span>
                </label>
              </td>
              <td>{(page - 1) * DOCUMENTS_PER_PAGE + index + 1}</td>
              <td>
                <strong className="document-file-name" title={document.fileName}>{truncateFileName(document.fileName)}</strong>
                <span className="document-meta">화학물질 {document.componentCount} · 검수 {document.queueCount}</span>
                <span className="sr-only">{document.uploadedAt.slice(0, 10)} · 화학물질 {document.componentCount} · 검수 {document.queueCount}</span>
              </td>
              <td>{document.uploadedAt.slice(0, 10)}</td>
              <td><code>{displayDocumentState(document)}</code></td>
              <td className="document-row-actions">
                <a aria-label={`${document.fileName} 첨부파일 다운로드`} className="secondary-action" href={api.documentFileUrl(document.documentId)}>첨부</a>
                <button aria-label={`${document.fileName} MSDS에서 보기`} className="secondary-action" onClick={() => onOpenDocument(document.documentId)} type="button">보기</button>
              </td>
              <td>
                <button aria-label={`${document.fileName} 삭제`} className="icon-danger-action" onClick={() => onDeleteDocument(document.documentId)} type="button">X</button>
              </td>
            </tr>
          ))}
            </tbody>
          </table>
        </div>
        {filteredDocuments.length > DOCUMENTS_PER_PAGE ? (
          <div className="pagination-controls">
            <button aria-label="이전 페이지" disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))} type="button">이전 슬롯</button>
            <span>{page} / {pageCount}</span>
            {Array.from({ length: pageCount }, (_, index) => index + 1).map((pageNumber) => (
              <button
                aria-current={page === pageNumber ? "page" : undefined}
                aria-label={`${pageNumber}페이지`}
                key={pageNumber}
                onClick={() => setPage(pageNumber)}
                type="button"
              >
                {pageNumber}번 슬롯
              </button>
            ))}
            <button aria-label="다음 페이지" disabled={page === pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))} type="button">다음 슬롯</button>
          </div>
        ) : null}
      </section>
    </main>
  );
}

function normalizeSearchText(value: string) {
  return value.normalize("NFC").trim().toLowerCase();
}

function displayDocumentState(document: DocumentSummary) {
  if (document.queueCount > 0) return "검수 필요";
  if (document.componentCount > 0) return "등록됨";
  return "분석 필요";
}

function truncateFileName(fileName: string) {
  return fileName.length > 20 ? `${fileName.slice(0, 20)}...` : fileName;
}
