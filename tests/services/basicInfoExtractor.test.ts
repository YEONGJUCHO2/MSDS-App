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

  it("does not confuse section titles with supplier values", () => {
    const fields = extractDocumentBasicInfo({
      fileName: "CSW-0001_MSDS_CS-200_KR연강용.pdf",
      queueCount: 0,
      textContent: [
        "1-1. 제품명 : CS-200 (AWS A5.1 E6019)",
        "1-2. 제품의 권고 용도와 사용상의 제한",
        "1) 용 도 : 고압보일러, 조선의 주요부문",
        "1-3. 제조자/공급자/유통정보",
        "1) 생산 및 공급 회사명 : 조선선재㈜",
        "3) 정보 제공 및 긴급연락 전화번호 : 080-285-9080, 052-237-5301~6",
        "개정일자 : 2013.4.1"
      ].join("\n")
    });

    expect(Object.fromEntries(fields.map((field) => [field.label, field.value]))).toMatchObject({
      "공급사": "조선선재㈜",
      "제조사": "조선선재㈜",
      "대표전화": "080-285-9080",
      "제품명": "CS-200 (AWS A5.1 E6019)",
      "용도": "고압보일러, 조선의 주요부문",
      "최종개정일자": "2013-04-01"
    });
  });

  it("maps section 1 label blocks where labels and values are split across lines", () => {
    const fields = extractDocumentBasicInfo({
      fileName: "실리콘MSDS_707_백색.pdf",
      queueCount: 0,
      textContent: [
        "개정일 : 2013년 7월 1일",
        "품명 : BIO 707 백색",
        "1. 화학제품과 회사에 관한 정보",
        "제품명 :",
        "제품의 권고 용도와 사용상의 제한 :",
        "제조-공급자 정보",
        "◦ 제조-공급회사명 :",
        "◦ 주소 :",
        "◦ 긴급연락전화번호 :",
        "BIO 707 백색",
        "실링재",
        "다우실란트산업㈜ 화성지점",
        "경기도 화성시 팔탄면 하저길 83",
        "031-357-5181 / 02-838-3556",
        "2. 유해, 위험성"
      ].join("\n")
    });

    expect(Object.fromEntries(fields.map((field) => [field.label, field.value]))).toMatchObject({
      "공급사": "다우실란트산업㈜ 화성지점",
      "제조사": "다우실란트산업㈜ 화성지점",
      "대표전화": "031-357-5181",
      "제품명": "BIO 707 백색",
      "용도": "실링재",
      "최종개정일자": "2013-07-01"
    });
  });

  it("does not use emergency phone labels as supplier candidates in split label blocks", () => {
    const fields = extractDocumentBasicInfo({
      fileName: "CA-13R(부정형) 내화물.pdf",
      queueCount: 1,
      textContent: [
        "1. 화학제품과 회사에 관한 정보",
        "제품명 :",
        "제품의 권고 용도와 사용상의 제한 :",
        "공급자 정보",
        "공급회사명 :",
        "주소 :",
        "긴급전화번호 :",
        "CA-13R(부정형) 내화물",
        "내화물 보수재",
        "조선내화 주식회사",
        "전라남도 광양시 산업로 55",
        "061-760-1234",
        "2. 유해성·위험성"
      ].join("\n")
    });

    expect(Object.fromEntries(fields.map((field) => [field.label, field.value]))).toMatchObject({
      "공급사": "조선내화 주식회사",
      "제조사": "조선내화 주식회사",
      "대표전화": "061-760-1234",
      "제품명": "CA-13R(부정형) 내화물",
      "용도": "내화물 보수재"
    });
  });
});
