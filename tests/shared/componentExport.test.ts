import { describe, expect, it } from "vitest";
import type { Section3Row } from "../../shared/types";
import { formatComponentForClipboard } from "../../server/services/copyFormat";

describe("component export format", () => {
  it("formats reviewed component rows in the internal chemical table column order", () => {
    const row: Section3Row = {
      rowId: "row-1",
      rowIndex: 0,
      rawRowText: "산화알루미늄 1344-28-1 1~5",
      casNoCandidate: "1344-28-1",
      chemicalNameCandidate: "산화알루미늄",
      contentMinCandidate: "1",
      contentMaxCandidate: "5",
      contentSingleCandidate: "",
      contentText: "1~5",
      confidence: 0.92,
      evidenceLocation: "SECTION 3 / row 1",
      reviewStatus: "approved",
      regulatoryMatches: [
        match("managedHazardousSubstance", "해당 후보", "산화알루미늄"),
        match("workEnvironmentMeasurement", "해당 후보", "산화알루미늄 6개월"),
        match("exposureLimit", "해당 후보", "산화알루미늄"),
        match("specialHealthExam", "해당 후보", "산화알루미늄 12개월")
      ]
    };

    const headers = [
      "CAS No.",
      "화학물질",
      "MIN",
      "MAX",
      "단일",
      "특별관리물질",
      "관리대상유해물질",
      "허가대상물질",
      "제조금지물질",
      "PSM",
      "작업환경측정 대상물질",
      "노출기준설정물질",
      "허용기준설정물질",
      "특수건강검진대상물질",
      "금지물질",
      "제한물질",
      "허가물질",
      "유독물질",
      "사고대비물질"
    ];

    expect(formatComponentForClipboard(row)).toBe([
      headers.join("\t"),
      [
        "1344-28-1",
        "산화알루미늄",
        "1",
        "5",
        "",
        "",
        "Y",
        "",
        "",
        "",
        "6개월",
        "Y",
        "",
        "12개월",
        "",
        "",
        "",
        "",
        ""
      ].join("\t")
    ].join("\n"));
  });

  it("reflects mapped official API classifications in the internal columns", () => {
    const row: Section3Row = {
      rowId: "row-1",
      rowIndex: 0,
      rawRowText: "Methylethylketoxime 96-29-7 0.1~1",
      casNoCandidate: "96-29-7",
      chemicalNameCandidate: "Methylethylketoxime",
      contentMinCandidate: "0.1",
      contentMaxCandidate: "1",
      contentSingleCandidate: "",
      contentText: "0.1~1",
      confidence: 0.92,
      evidenceLocation: "SECTION 3 / row 1",
      reviewStatus: "needs_review",
      regulatoryMatches: [
        match("chemicalInfoLookup", "공식 API 조회됨", "메틸 에틸 케톡심 / 96-29-7 / KE-03881"),
        match("toxic", "공식 API 조회됨", "인체등유해성물질 / 2023-1-1127 / 인체만성유해성 : 0.1%"),
        match("restricted", "공식 API 조회됨", "제한물질 / 06-5-8")
      ]
    };

    const values = formatComponentForClipboard(row).split("\n")[1].split("\t");

    expect(values[15]).toBe("Y");
    expect(values[17]).toBe("Y");
  });
});

function match(category: string, status: string, evidenceText: string) {
  return {
    matchId: `match-${category}`,
    rowId: "row-1",
    documentId: "doc-1",
    casNo: "1344-28-1",
    category,
    status,
    sourceType: "internal_seed" as const,
    sourceName: "내부 기준표",
    sourceUrl: "internal://seed",
    evidenceText,
    checkedAt: "2026-04-25T00:00:00.000Z"
  };
}
