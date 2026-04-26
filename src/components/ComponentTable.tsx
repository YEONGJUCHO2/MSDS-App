import { useState } from "react";
import type { Section3Row } from "../../shared/types";
import {
  countComponentExportRegulatoryHits,
  formatComponentExportRow,
  formatComponentRowsAsTsv,
  hasOfficialLookupOnlyMatches,
  REGULATORY_COMPONENT_EXPORT_COLUMNS
} from "../../shared/componentExport";
import type { ComponentCandidatePayload } from "../api/client";

interface ComponentTableProps {
  rows: Section3Row[];
  onAdd?: (payload: ComponentCandidatePayload, recheckAfterSave: boolean) => void;
  onUpdate?: (rowId: string, payload: ComponentCandidatePayload, recheckAfterSave: boolean) => void;
  onRemove?: (rowId: string) => void;
  onRecheck?: (rowId: string) => void;
}

const blankCandidate: ComponentCandidatePayload = {
  casNoCandidate: "",
  chemicalNameCandidate: "",
  contentMinCandidate: "",
  contentMaxCandidate: "",
  contentSingleCandidate: ""
};

export function ComponentTable({ rows, onAdd, onRemove, onRecheck, onUpdate }: ComponentTableProps) {
  const exportHitCount = countComponentExportRegulatoryHits(rows);
  const hasOfficialOnlyMatches = hasOfficialLookupOnlyMatches(rows);
  const [editingRowId, setEditingRowId] = useState("");
  const [draft, setDraft] = useState<ComponentCandidatePayload>(blankCandidate);
  const [adding, setAdding] = useState(false);
  const [addDraft, setAddDraft] = useState<ComponentCandidatePayload>(blankCandidate);
  const [recheckAfterSave, setRecheckAfterSave] = useState(false);
  const [formError, setFormError] = useState("");
  const [copyFeedback, setCopyFeedback] = useState("");
  const [saving, setSaving] = useState(false);

  async function copyAllRows() {
    setCopyFeedback("");
    try {
      await navigator.clipboard?.writeText(formatComponentRowsAsTsv(rows));
      setCopyFeedback("사내 입력 포맷을 클립보드에 복사했습니다.");
    } catch {
      setCopyFeedback("브라우저가 클립보드 복사를 허용하지 않았습니다. 표를 직접 선택해 복사해주세요.");
    }
  }

  function startEdit(row: Section3Row) {
    setAdding(false);
    setEditingRowId(row.rowId ?? "");
    setDraft(toPayload(row));
    setRecheckAfterSave(false);
    setFormError("");
  }

  async function saveEdit() {
    if (!editingRowId || !onUpdate || saving) return;
    if (!isValidCandidate(draft)) {
      setFormError("CAS No. 또는 화학물질명 중 하나는 필요합니다.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      await onUpdate(editingRowId, draft, recheckAfterSave);
      setEditingRowId("");
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function saveAdd() {
    if (!onAdd || saving) return;
    if (!isValidCandidate(addDraft)) {
      setFormError("CAS No. 또는 화학물질명 중 하나는 필요합니다.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      await onAdd(addDraft, recheckAfterSave);
      setAddDraft(blankCandidate);
      setRecheckAfterSave(false);
      setAdding(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="panel table-panel">
      <div className="panel-title">
        <h2>사내 입력 포맷</h2>
        <span>사내 입력 반영 {exportHitCount}건</span>
        {onAdd ? <button onClick={() => {
          setEditingRowId("");
          setAdding(true);
          setRecheckAfterSave(false);
          setFormError("");
        }} type="button">추가</button> : null}
        <button disabled={rows.length === 0} onClick={copyAllRows} type="button">전체 복사</button>
      </div>
      {adding ? (
        <ComponentEditForm
          draft={addDraft}
          primaryLabel="추가 저장"
          recheckAfterSave={recheckAfterSave}
          errorMessage={formError}
          saving={saving}
          onCancel={() => setAdding(false)}
          onChange={setAddDraft}
          onRecheckAfterSaveChange={setRecheckAfterSave}
          onSubmit={saveAdd}
        />
      ) : null}
      {hasOfficialOnlyMatches && exportHitCount === 0 ? (
        <p className="lookup-feedback">공식 정보 조회만 된 항목은 사내 입력 컬럼에 표시하지 않습니다.</p>
      ) : null}
      {copyFeedback ? <p className="lookup-feedback compact">{copyFeedback}</p> : null}
      <div className="table-shell">
        <table className="component-export-table">
          <thead>
            <tr>
              {REGULATORY_COMPONENT_EXPORT_COLUMNS.map((column) => (
                <th key={column.key}>{column.label}</th>
              ))}
              {onUpdate || onRemove || onRecheck ? <th>작업</th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isEditing = row.rowId === editingRowId;
              return (
                <tr key={row.rowId}>
                  {isEditing ? (
                    <td colSpan={REGULATORY_COMPONENT_EXPORT_COLUMNS.length + 1}>
                      <ComponentEditForm
                        draft={draft}
                        primaryLabel="저장"
                        recheckAfterSave={recheckAfterSave}
                        errorMessage={formError}
                        saving={saving}
                        onCancel={() => setEditingRowId("")}
                        onChange={setDraft}
                        onRecheckAfterSaveChange={setRecheckAfterSave}
                        onSubmit={saveEdit}
                      />
                    </td>
                  ) : (
                    <>
                      {formatComponentExportRow(row).map((value, index) => (
                        <td key={`${row.rowId ?? row.rowIndex}-${REGULATORY_COMPONENT_EXPORT_COLUMNS[index].key}`}>{value}</td>
                      ))}
                      {onUpdate || onRemove || onRecheck ? (
                        <td className="row-actions">
                          {row.rowId && onUpdate ? <button onClick={() => startEdit(row)} type="button">수정</button> : null}
                          {row.rowId && onRecheck ? <button onClick={() => onRecheck(row.rowId!)} type="button">재조회</button> : null}
                          {row.rowId && onRemove ? <button onClick={() => onRemove(row.rowId!)} type="button">제거</button> : null}
                        </td>
                      ) : null}
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ComponentEditForm({
  draft,
  errorMessage,
  onCancel,
  onChange,
  onRecheckAfterSaveChange,
  onSubmit,
  primaryLabel,
  recheckAfterSave,
  saving
}: {
  draft: ComponentCandidatePayload;
  errorMessage?: string;
  onCancel: () => void;
  onChange: (draft: ComponentCandidatePayload) => void;
  onRecheckAfterSaveChange: (checked: boolean) => void;
  onSubmit: () => void;
  primaryLabel: string;
  recheckAfterSave: boolean;
  saving?: boolean;
}) {
  function update<K extends keyof ComponentCandidatePayload>(key: K, value: ComponentCandidatePayload[K]) {
    onChange({ ...draft, [key]: value });
  }

  return (
    <div className="component-edit-form">
      <label>
        CAS No.
        <input value={draft.casNoCandidate} onChange={(event) => update("casNoCandidate", event.target.value)} />
      </label>
      <label>
        화학물질명
        <input value={draft.chemicalNameCandidate} onChange={(event) => update("chemicalNameCandidate", event.target.value)} />
      </label>
      <label>
        MIN
        <input value={draft.contentMinCandidate} onChange={(event) => update("contentMinCandidate", event.target.value)} />
      </label>
      <label>
        MAX
        <input value={draft.contentMaxCandidate} onChange={(event) => update("contentMaxCandidate", event.target.value)} />
      </label>
      <label>
        단일
        <input value={draft.contentSingleCandidate} onChange={(event) => update("contentSingleCandidate", event.target.value)} />
      </label>
      <label className="inline-check">
        <input checked={recheckAfterSave} onChange={(event) => onRecheckAfterSaveChange(event.target.checked)} type="checkbox" />
        저장 후 API 재조회
      </label>
      <div className="edit-actions">
        <button disabled={saving} onClick={onSubmit} type="button">{saving ? "저장중" : primaryLabel}</button>
        <button disabled={saving} onClick={onCancel} type="button">취소</button>
      </div>
      {errorMessage ? <p className="lookup-feedback compact edit-error">{errorMessage}</p> : null}
    </div>
  );
}

function toPayload(row: Section3Row): ComponentCandidatePayload {
  return {
    casNoCandidate: row.casNoCandidate,
    chemicalNameCandidate: row.chemicalNameCandidate,
    contentMinCandidate: row.contentMinCandidate,
    contentMaxCandidate: row.contentMaxCandidate,
    contentSingleCandidate: row.contentSingleCandidate
  };
}

function isValidCandidate(candidate: ComponentCandidatePayload) {
  return Boolean(candidate.casNoCandidate.trim() || candidate.chemicalNameCandidate.trim());
}
