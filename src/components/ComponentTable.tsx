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

  function copyAllRows() {
    void navigator.clipboard?.writeText(formatComponentRowsAsTsv(rows));
  }

  function startEdit(row: Section3Row) {
    setAdding(false);
    setEditingRowId(row.rowId ?? "");
    setDraft(toPayload(row));
    setRecheckAfterSave(false);
  }

  function saveEdit() {
    if (!editingRowId || !onUpdate) return;
    onUpdate(editingRowId, draft, recheckAfterSave);
    setEditingRowId("");
  }

  function saveAdd() {
    if (!onAdd) return;
    onAdd(addDraft, recheckAfterSave);
    setAddDraft(blankCandidate);
    setRecheckAfterSave(false);
    setAdding(false);
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
        }} type="button">추가</button> : null}
        <button disabled={rows.length === 0} onClick={copyAllRows} type="button">전체 복사</button>
      </div>
      {adding ? (
        <ComponentEditForm
          draft={addDraft}
          primaryLabel="추가 저장"
          recheckAfterSave={recheckAfterSave}
          onCancel={() => setAdding(false)}
          onChange={setAddDraft}
          onRecheckAfterSaveChange={setRecheckAfterSave}
          onSubmit={saveAdd}
        />
      ) : null}
      {hasOfficialOnlyMatches && exportHitCount === 0 ? (
        <p className="lookup-feedback">공식 정보 조회만 된 항목은 사내 입력 컬럼에 표시하지 않습니다.</p>
      ) : null}
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
  onCancel,
  onChange,
  onRecheckAfterSaveChange,
  onSubmit,
  primaryLabel,
  recheckAfterSave
}: {
  draft: ComponentCandidatePayload;
  onCancel: () => void;
  onChange: (draft: ComponentCandidatePayload) => void;
  onRecheckAfterSaveChange: (checked: boolean) => void;
  onSubmit: () => void;
  primaryLabel: string;
  recheckAfterSave: boolean;
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
        <button onClick={onSubmit} type="button">{primaryLabel}</button>
        <button onClick={onCancel} type="button">취소</button>
      </div>
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
