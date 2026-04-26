import { useEffect, useState, type FormEvent } from "react";
import type { BasicInfoField } from "../../shared/types";

interface BasicInfoPanelProps {
  documentId: string;
  fields: BasicInfoField[];
  isLoading?: boolean;
  onSave: (fields: BasicInfoField[]) => Promise<void>;
}

export function BasicInfoPanel({ documentId, fields, isLoading = false, onSave }: BasicInfoPanelProps) {
  const [draftValues, setDraftValues] = useState<Record<string, string>>({});
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    setDraftValues(Object.fromEntries(fields.map((field) => [field.key, field.value])));
  }, [fields]);

  useEffect(() => {
    setSaveState("idle");
  }, [documentId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaveState("saving");
    try {
      await onSave(fields.map((field) => ({
        ...field,
        value: draftValues[field.key] ?? ""
      })));
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }

  return (
    <form className="panel basic-info-panel" onSubmit={handleSubmit}>
      <div className="panel-title">
        <h2>물품 기본 정보</h2>
        <div className="basic-info-actions">
          <span>{saveStateLabel(saveState)}</span>
          <button data-testid="basic-info-save" disabled={fields.length === 0 || saveState === "saving"} type="submit">저장</button>
        </div>
      </div>
      {isLoading && fields.length === 0 ? (
        <div className="empty">물품 기본 정보를 불러오는 중입니다.</div>
      ) : null}
      {!isLoading && fields.length === 0 ? (
        <div className="empty">물품 기본 정보 후보가 없습니다.</div>
      ) : null}
      {fields.length > 0 ? (
        <div className="basic-info-grid">
          {fields.map((field) => (
          <div className="basic-info-pair" key={field.key}>
            <label className="basic-info-label" htmlFor={`basic-${field.key}`}>{field.label}</label>
            <input
              className={`basic-info-value source-${field.source}`}
              id={`basic-${field.key}`}
              onChange={(event) => {
                setDraftValues((current) => ({ ...current, [field.key]: event.target.value }));
                setSaveState("idle");
              }}
              placeholder="수동입력 필요"
              type="text"
              value={draftValues[field.key] ?? ""}
            />
          </div>
          ))}
        </div>
      ) : null}
    </form>
  );
}

function saveStateLabel(saveState: "idle" | "saving" | "saved" | "error") {
  if (saveState === "saving") return "저장 중";
  if (saveState === "saved") return "저장됨";
  if (saveState === "error") return "저장 실패";
  return "사내 등록 화면 기준";
}
