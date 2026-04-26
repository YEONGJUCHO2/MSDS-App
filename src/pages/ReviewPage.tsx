import { useEffect, useState } from "react";
import { processingStatusLabels } from "../../shared/status";
import type { BasicInfoField, DocumentSummary, RegulatoryRecheckResult, Section3Row } from "../../shared/types";
import { api, type ComponentCandidatePayload } from "../api/client";
import { BasicInfoPanel } from "../components/BasicInfoPanel";
import { ComponentReviewPanel } from "../components/ComponentReviewPanel";
import { ComponentTable } from "../components/ComponentTable";

export function ReviewPage({ documents, onDeleteDocument }: { documents: DocumentSummary[]; onDeleteDocument: (documentId: string) => void }) {
  const [selectedId, setSelectedId] = useState(documents[0]?.documentId ?? "");
  const [rows, setRows] = useState<Section3Row[]>([]);
  const [basicInfoFields, setBasicInfoFields] = useState<BasicInfoField[]>([]);
  const [recheckingRowId, setRecheckingRowId] = useState("");
  const [recheckMessages, setRecheckMessages] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!selectedId) return;
    let active = true;
    setRows([]);
    setBasicInfoFields([]);
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

  return (
    <main className="review-layout">
      <aside className="sidebar-list">
        {documents.map((document) => (
          <div className={`sidebar-document ${selectedId === document.documentId ? "selected" : ""}`} key={document.documentId}>
            <button onClick={() => setSelectedId(document.documentId)} type="button">
              <strong>{document.fileName}</strong>
              <span>{processingStatusLabels[document.status]}</span>
            </button>
            <button aria-label={`${document.fileName} 삭제`} className="sidebar-delete" onClick={() => onDeleteDocument(document.documentId)} type="button">삭제</button>
          </div>
        ))}
      </aside>
      <div className="review-main">
        <BasicInfoPanel documentId={selectedId} fields={basicInfoFields} onSave={handleSaveBasicInfo} />
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
