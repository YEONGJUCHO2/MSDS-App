import type { Section3Row } from "../../shared/types";
import { formatComponentExportRow, formatComponentRowsAsTsv, REGULATORY_COMPONENT_EXPORT_COLUMNS } from "../../shared/componentExport";

export function ComponentTable({ rows }: { rows: Section3Row[] }) {
  function copyAllRows() {
    void navigator.clipboard?.writeText(formatComponentRowsAsTsv(rows));
  }

  return (
    <div className="panel table-panel">
      <div className="panel-title">
        <h2>사내 입력 포맷</h2>
        <button disabled={rows.length === 0} onClick={copyAllRows} type="button">전체 복사</button>
      </div>
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
