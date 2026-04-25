import type { Section3Row } from "../../shared/types";
import {
  countComponentExportRegulatoryHits,
  formatComponentExportRow,
  formatComponentRowsAsTsv,
  hasOfficialLookupOnlyMatches,
  REGULATORY_COMPONENT_EXPORT_COLUMNS
} from "../../shared/componentExport";

export function ComponentTable({ rows }: { rows: Section3Row[] }) {
  const exportHitCount = countComponentExportRegulatoryHits(rows);
  const hasOfficialOnlyMatches = hasOfficialLookupOnlyMatches(rows);

  function copyAllRows() {
    void navigator.clipboard?.writeText(formatComponentRowsAsTsv(rows));
  }

  return (
    <div className="panel table-panel">
      <div className="panel-title">
        <h2>사내 입력 포맷</h2>
        <span>사내 입력 반영 {exportHitCount}건</span>
        <button disabled={rows.length === 0} onClick={copyAllRows} type="button">전체 복사</button>
      </div>
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
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.rowId}>
                {formatComponentExportRow(row).map((value, index) => (
                  <td key={`${row.rowId ?? row.rowIndex}-${REGULATORY_COMPONENT_EXPORT_COLUMNS[index].key}`}>{value}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
