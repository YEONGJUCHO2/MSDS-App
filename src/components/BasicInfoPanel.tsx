import type { BasicInfoField } from "../../shared/types";

export function BasicInfoPanel({ fields }: { fields: BasicInfoField[] }) {
  return (
    <section className="panel basic-info-panel">
      <div className="panel-title">
        <h2>물품 기본 정보</h2>
        <span>사내 등록 화면 기준</span>
      </div>
      <div className="basic-info-grid">
        {fields.map((field) => (
          <div className="basic-info-pair" key={field.key}>
            <div className="basic-info-label">{field.label}</div>
            <div className={`basic-info-value source-${field.source}`}>
              {field.value || "수동입력 필요"}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
