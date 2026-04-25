import { describe, expect, it } from "vitest";
import { extractDocumentBasicInfo } from "../../server/services/basicInfoExtractor";

describe("extractDocumentBasicInfo", () => {
  it("extracts candidates for the internal MSDS registration form", () => {
    const fields = extractDocumentBasicInfo({
      fileName: "MY-M-11 (MR-90).pdf",
      siteNames: "포항노재",
      queueCount: 0,
      textContent: [
        "공급사 포스코퓨처엠",
        "제조사 포스코퓨처엠",
        "대표전화 054-290-0538",
        "제품명 MY-M-11 (MR-90)",
        "용도 내화물",
        "MSDS번호 AA00786-0000000090",
        "최종개정일자 2026-04-02"
      ].join("\n")
    });

    expect(Object.fromEntries(fields.map((field) => [field.label, field.value]))).toMatchObject({
      "공급사": "포스코퓨처엠",
      "제조사": "포스코퓨처엠",
      "대표전화": "054-290-0538",
      "제품명": "MY-M-11 (MR-90)",
      "용도": "내화물",
      "MSDS번호": "AA00786-0000000090",
      "사업장": "포항노재",
      "최종개정일자": "2026-04-02",
      "구분": "검토완료"
    });
  });

  it("marks review category when the selected MSDS still has pending items", () => {
    const fields = extractDocumentBasicInfo({
      fileName: "unknown.pdf",
      queueCount: 2,
      textContent: ""
    });

    expect(Object.fromEntries(fields.map((field) => [field.label, field.value]))).toMatchObject({
      "제품명": "unknown",
      "구분": "검수 필요",
      "검토의견": "검수 필요 항목 검토 필요"
    });
  });
});
