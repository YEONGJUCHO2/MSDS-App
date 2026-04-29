import { useEffect, useMemo, useState } from "react";
import type { BasicInfoField, DocumentSummary, RegulatoryRecheckResult, Section3Row } from "../../shared/types";
import { api, type ComponentCandidatePayload } from "../api/client";
import { BasicInfoPanel } from "../components/BasicInfoPanel";
import { ComponentReviewPanel } from "../components/ComponentReviewPanel";
import { ComponentTable } from "../components/ComponentTable";

const DOCUMENTS_PER_PAGE = 5;

export function ReviewPage({
  documents,
  onDeleteDocument,
  onDeleteDocuments,
  onDocumentsRechecked,
  selectedDocumentId = ""
}: {
  documents: DocumentSummary[];
  onDeleteDocument: (documentId: string) => void;
  onDeleteDocuments?: (documentIds: string[]) => void;
  onDocumentsRechecked?: () => void | Promise<void>;
  selectedDocumentId?: string;
}) {
  const [selectedId, setSelectedId] = useState(documents[0]?.documentId ?? "");
  const [rows, setRows] = useState<Section3Row[]>([]);
  const [basicInfoFields, setBasicInfoFields] = useState<BasicInfoField[]>([]);
  const [basicInfoLoading, setBasicInfoLoading] = useState(false);
  const [recheckingRowId, setRecheckingRowId] = useState("");
  const [recheckMessages, setRecheckMessages] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<Set<string>>(() => new Set());
  const [batchBusy, setBatchBusy] = useState(false);
  const [batchMessage, setBatchMessage] = useState("");
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
  const pageDocuments = useMemo(() => filteredDocuments.slice((page - 1) * DOCUMENTS_PER_PAGE, page * DOCUMENTS_PER_PAGE), [filteredDocuments, page]);
  const visibleIds = pageDocuments.map((document) => document.documentId);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((documentId) => selectedDocumentIds.has(documentId));

  useEffect(() => {
    if (selectedDocumentId && documents.some((document) => document.documentId === selectedDocumentId)) {
      setSelectedId(selectedDocumentId);
    }
  }, [documents, selectedDocumentId]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  useEffect(() => {
    setPage(1);
  }, [documents, query]);

  useEffect(() => {
    if (!selectedId) return;
    let active = true;
    setRows([]);
    setBasicInfoFields([]);
    setBasicInfoLoading(true);
    void api.components(selectedId)
      .then((componentResult) => {
        if (active) setRows(componentResult.rows);
      })
      .catch(() => {
        if (active) setRows([]);
      });
    void api.documentBasicInfo(selectedId)
      .then((basicInfoResult) => {
        if (active) setBasicInfoFields(basicInfoResult.fields);
      })
      .catch(() => {
        if (active) setBasicInfoFields([]);
      })
      .finally(() => {
        if (active) setBasicInfoLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedId]);

  useEffect(() => {
    if (selectedId && !documents.some((document) => document.documentId === selectedId)) {
      setSelectedId(documents[0]?.documentId ?? "");
      setRows([]);
      setBasicInfoFields([]);
      setBasicInfoLoading(false);
      return;
    }
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

  async function handleAdd(payload: ComponentCandidatePayload, recheckAfterSave: boolean) {
    if (!selectedId) return;
    const result = await api.addComponent(selectedId, payload);
    setRows(result.rows);
    if (recheckAfterSave) {
      await handleRecheck(result.rowId);
    }
  }

  async function handleUpdate(rowId: string, payload: ComponentCandidatePayload, recheckAfterSave: boolean) {
    if (!selectedId) return;
    const result = await api.updateComponent(selectedId, rowId, payload);
    setRows(result.rows);
    setRecheckMessages((current) => ({ ...current, [rowId]: "수정값을 저장했습니다." }));
    if (recheckAfterSave) {
      await handleRecheck(rowId);
    }
  }

  async function handleRemove(rowId: string) {
    if (!selectedId) return;
    if (!window.confirm("이 성분 행을 사내 입력 포맷에서 제거할까요?")) return;
    const result = await api.removeComponent(selectedId, rowId);
    setRows(result.rows);
  }

  async function handleSaveBasicInfo(fields: BasicInfoField[]) {
    if (!selectedId) return;
    const result = await api.saveDocumentBasicInfo(selectedId, fields);
    setBasicInfoFields(result.fields);
  }

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
      const result = await api.recheckDocuments(documentIds);
      setBatchMessage(`${result.documentCount}개 MSDS · ${result.rowCount}개 성분 조회/재조회 완료`);
      if (selectedId && documentIds.includes(selectedId)) {
        const componentResult = await api.components(selectedId);
        setRows(componentResult.rows);
      }
      await onDocumentsRechecked?.();
    } catch (error) {
      setBatchMessage(error instanceof Error ? `조회/재조회 실패: ${error.message}` : "조회/재조회 실패");
    } finally {
      setBatchBusy(false);
    }
  }

  return (
    <main className="review-layout review-flow">
      <section className="panel wide msds-list-panel">
        <div className="panel-title">
          <h2>MSDS</h2>
          <label className="dashboard-search">
            <span>MSDS 검색</span>
            <input
              placeholder="파일명, 상태, 날짜로 MSDS 검색"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <button disabled={batchBusy || selectedDocumentIds.size === 0} onClick={() => void handleBatchRecheck()} type="button">선택 조회/재조회</button>
          <button disabled={selectedDocumentIds.size === 0} onClick={handleSelectedDownload} type="button">선택 첨부 다운로드</button>
          <button disabled={selectedDocumentIds.size === 0} onClick={handleSelectedDelete} type="button">선택항목 삭제</button>
        </div>
        <div className="document-list-controls">
          <label>
            <input checked={allVisibleSelected} disabled={pageDocuments.length === 0} onChange={toggleVisibleDocuments} type="checkbox" />
            현재 페이지 MSDS 전체 선택
          </label>
          <span>{selectedDocumentIds.size}개 선택</span>
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
                <tr className={selectedId === document.documentId ? "selected" : ""} key={document.documentId}>
                  <td>
                    <label className="document-select">
                      <input checked={selectedDocumentIds.has(document.documentId)} onChange={() => toggleDocument(document.documentId)} type="checkbox" />
                      <span className="sr-only">{document.fileName} 선택</span>
                    </label>
                  </td>
                  <td>{(page - 1) * DOCUMENTS_PER_PAGE + index + 1}</td>
                  <td>
                    <button aria-label={`${document.fileName} MSDS 선택`} className="document-file-button" onClick={() => setSelectedId(document.documentId)} title={document.fileName} type="button">
                      {truncateFileName(document.fileName)}
                    </button>
                    <span className="document-meta">화학물질 {document.componentCount} · 검수 {document.queueCount}</span>
                    <span className="sr-only">{document.uploadedAt.slice(0, 10)} · 화학물질 {document.componentCount} · 검수 {document.queueCount}</span>
                  </td>
                  <td>{document.uploadedAt.slice(0, 10)}</td>
                  <td><code>{displayDocumentState(document)}</code></td>
                  <td className="document-row-actions">
                    <a aria-label={`${document.fileName} 첨부파일 다운로드`} className="secondary-action" href={api.documentFileUrl(document.documentId)}>첨부</a>
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
      <div className="review-main">
        <BasicInfoPanel documentId={selectedId} fields={basicInfoFields} isLoading={basicInfoLoading} onSave={handleSaveBasicInfo} />
        <ComponentTable
          rows={rows}
          onAdd={handleAdd}
          onRemove={handleRemove}
          onRecheck={handleRecheck}
          onUpdate={handleUpdate}
        />
        <details className="panel evidence-panel">
          <summary>추출 근거 보기</summary>
          <ComponentReviewPanel
            rows={rows}
            onRecheck={handleRecheck}
            recheckMessages={recheckMessages}
            recheckingRowId={recheckingRowId}
          />
        </details>
      </div>
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

function describeRecheckResult(result: RegulatoryRecheckResult) {
  if (result.status === "api_key_required") {
    return "공식 API URL/키가 설정되지 않아 외부 조회는 실행되지 않았습니다.";
  }
  if (result.status === "official_api_matched") {
    return `공식 API 조회 ${result.apiMatches}건을 반영했습니다.`;
  }
  if (result.status === "internal_seed_matched") {
    return `공식 API 조회 결과는 없고 내부 기준 ${result.seedMatches}건을 반영했습니다.`;
  }
  return "공식조회 완료: 매칭 없음.";
}
