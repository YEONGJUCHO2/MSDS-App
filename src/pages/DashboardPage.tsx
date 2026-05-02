import { AlertTriangle, BellRing, Calendar, Database, FileText, Paperclip, Pencil } from "lucide-react";
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
  onRenameDocument?: (documentId: string, fileName: string) => void | Promise<void>;
  onRecheckDocuments: (documentIds: string[]) => Promise<{ documentCount: number; rowCount: number }> | { documentCount: number; rowCount: number };
  onUploadReplacement?: (documentId: string, file: File) => void | Promise<void>;
}

export function DashboardPage({ documents, queueItems, onDeleteDocument, onDeleteDocuments, onOpenDocument, onNavigate, onRenameDocument, onRecheckDocuments, onUploadReplacement }: DashboardPageProps) {
  const [query, setQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [dateFilterOpen, setDateFilterOpen] = useState(false);
  const [reviewStateFilter, setReviewStateFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<Set<string>>(() => new Set());
  const [renameDrafts, setRenameDrafts] = useState<Record<string, string>>({});
  const [editingDocumentId, setEditingDocumentId] = useState("");
  const [batchBusy, setBatchBusy] = useState(false);
  const [batchMessage, setBatchMessage] = useState("");
  const pendingAttentionCount = documents.filter(isDocumentReviewNeeded).length;
  const componentCount = documents.reduce((sum, doc) => sum + doc.componentCount, 0);
  const revisionNeededCount = 0;
  const cards = [
    { label: "등록된 MSDS", value: documents.length, icon: FileText, page: "review" },
    { label: "검수 필요", value: pendingAttentionCount, icon: AlertTriangle, page: "review" },
    { label: "등록된 화학물질", value: componentCount, icon: Database, page: "watchlist" },
    { label: "개정 필요", value: revisionNeededCount, icon: BellRing, page: "review" }
  ];
  const filteredDocuments = useMemo(() => {
    const normalizedQuery = normalizeSearchText(query);
    return documents.filter((document) => {
      const uploadedDate = document.uploadedAt.slice(0, 10);
      const reviewState = getDocumentReviewState(document);
      const matchesQuery = !normalizedQuery || [
        document.fileName,
        displayDocumentState(document),
        uploadedDate,
        String(document.componentCount),
        String(document.queueCount)
      ].some((value) => normalizeSearchText(value).includes(normalizedQuery));
      const matchesDateFrom = !dateFrom || uploadedDate >= dateFrom;
      const matchesDateTo = !dateTo || uploadedDate <= dateTo;
      const matchesReviewState = reviewStateFilter === "all" || reviewState === reviewStateFilter;
      return matchesQuery && matchesDateFrom && matchesDateTo && matchesReviewState;
    });
  }, [dateFrom, dateTo, documents, query, reviewStateFilter]);
  const pageCount = Math.max(1, Math.ceil(filteredDocuments.length / DOCUMENTS_PER_PAGE));
  const pageDocuments = filteredDocuments.slice((page - 1) * DOCUMENTS_PER_PAGE, page * DOCUMENTS_PER_PAGE);
  const selectedCount = selectedDocumentIds.size;
  const visibleIds = pageDocuments.map((document) => document.documentId);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((documentId) => selectedDocumentIds.has(documentId));

  useEffect(() => {
    setPage(1);
  }, [query, dateFrom, dateTo, reviewStateFilter, documents]);

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

  function handleRename(documentId: string, fallbackFileName: string) {
    const nextFileName = (renameDrafts[documentId] ?? fallbackFileName).trim();
    if (!nextFileName || nextFileName === fallbackFileName) return;
    void onRenameDocument?.(documentId, nextFileName);
    setEditingDocumentId("");
  }

  function startRename(documentId: string, fileName: string) {
    setRenameDrafts((current) => ({ ...current, [documentId]: current[documentId] ?? fileName }));
    setEditingDocumentId(documentId);
  }

  function handleDateFromChange(value: string) {
    setDateFrom(value);
    if (!value) return;
    setDateTo((current) => clampDateToRange(value, current));
  }

  function handleDateToChange(value: string) {
    setDateTo(dateFrom ? clampDateToRange(dateFrom, value) : value);
  }

  function handleReplacement(documentId: string, fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;
    void onUploadReplacement?.(documentId, file);
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
          <button aria-expanded={dateFilterOpen} className="icon-text-button" onClick={() => setDateFilterOpen((current) => !current)} type="button">
            <Calendar aria-hidden="true" size={16} />
            등록일 조회
          </button>
          {dateFilterOpen ? (
            <>
              <label className="dashboard-search compact-filter">
                <span>등록 시작일</span>
                <input aria-label="등록 시작일" max={dateTo || undefined} min={dateTo ? addMonthsToDateInput(dateTo, -6) : undefined} type="date" value={dateFrom} onChange={(event) => handleDateFromChange(event.target.value)} />
              </label>
              <label className="dashboard-search compact-filter">
                <span>등록 종료일</span>
                <input aria-label="등록 종료일" max={dateFrom ? addMonthsToDateInput(dateFrom, 6) : undefined} min={dateFrom || undefined} type="date" value={dateTo} onChange={(event) => handleDateToChange(event.target.value)} />
              </label>
            </>
          ) : null}
          <label className="dashboard-search compact-filter">
            <span>검수 상태</span>
            <select aria-label="검수 상태" value={reviewStateFilter} onChange={(event) => setReviewStateFilter(event.target.value)}>
              <option value="all">전체</option>
              <option value="approved">검수 완료</option>
              <option value="needs_review">검수 필요</option>
            </select>
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
                <span className="document-file-title-row">
                  <strong className="document-file-name" title={document.fileName}>{truncateFileName(document.fileName)}</strong>
                  {onRenameDocument ? (
                    <button aria-label={`${document.fileName} 이름 수정`} className="title-icon-button" onClick={() => startRename(document.documentId, document.fileName)} title="이름 수정" type="button">
                      <Pencil aria-hidden="true" size={14} />
                    </button>
                  ) : null}
                </span>
                {onRenameDocument && editingDocumentId === document.documentId ? (
                  <span className="document-rename-control">
                    <input
                      aria-label={`${document.fileName} 이름 변경`}
                      value={renameDrafts[document.documentId] ?? document.fileName}
                      onChange={(event) => setRenameDrafts((current) => ({ ...current, [document.documentId]: event.target.value }))}
                    />
                    <button aria-label={`${document.fileName} 이름 저장`} onClick={() => handleRename(document.documentId, document.fileName)} type="button">저장</button>
                  </span>
                ) : null}
                <span className="document-meta">화학물질 {document.componentCount} · 검수 {document.queueCount}</span>
                <span className="sr-only">{document.uploadedAt.slice(0, 10)} · 화학물질 {document.componentCount} · 검수 {document.queueCount}</span>
              </td>
              <td>{document.uploadedAt.slice(0, 10)}</td>
              <td><code>{displayDocumentState(document)}</code></td>
              <td>
                <div className="document-row-actions">
                  <a aria-label={`${document.fileName} 첨부파일 열기`} className="secondary-action attachment-action" href={api.documentFileUrl(document.documentId)} target="_blank" rel="noreferrer">
                    <Paperclip aria-hidden="true" size={14} />
                    첨부
                  </a>
                  <button aria-label={`${document.fileName} MSDS에서 보기`} className="secondary-action" onClick={() => onOpenDocument(document.documentId)} type="button">보기</button>
                  {onUploadReplacement && isDocumentReviewNeeded(document) ? (
                    <label className="secondary-action replacement-action">
                      재첨부
                      <input aria-label={`${document.fileName} 새 MSDS 재첨부`} type="file" accept=".pdf,.docx,.xlsx,.csv,application/pdf" onChange={(event) => handleReplacement(document.documentId, event.target.files)} />
                    </label>
                  ) : null}
                </div>
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
  const reviewState = getDocumentReviewState(document);
  if (reviewState === "needs_review") return "검수 필요";
  if (reviewState === "approved" && document.componentCount > 0) return "검수 완료";
  if (document.queueCount > 0) return "검수 필요";
  if (document.componentCount > 0) return "등록됨";
  return "분석 필요";
}

function getDocumentReviewState(document: DocumentSummary) {
  if (document.reviewState) return document.reviewState;
  if (document.queueCount > 0) return "needs_review";
  if (document.componentCount > 0) return "approved";
  return "unknown";
}

function isDocumentReviewNeeded(document: DocumentSummary) {
  return getDocumentReviewState(document) === "needs_review";
}

function truncateFileName(fileName: string) {
  return fileName.length > 20 ? `${fileName.slice(0, 20)}...` : fileName;
}

function clampDateToRange(dateFrom: string, nextDateTo: string) {
  if (!nextDateTo) return nextDateTo;
  if (nextDateTo < dateFrom) return dateFrom;
  const maxDateTo = addMonthsToDateInput(dateFrom, 6);
  return nextDateTo > maxDateTo ? maxDateTo : nextDateTo;
}

function addMonthsToDateInput(value: string, months: number) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  const date = new Date(Date.UTC(year, month - 1 + months, day));
  return date.toISOString().slice(0, 10);
}
