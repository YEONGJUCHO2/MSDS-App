import { describe, expect, it } from "vitest";
import { extractSection3Rows } from "../../server/services/tableExtractor";

describe("table extractor", () => {
  it("keeps CAS, chemical name, and concentration from the same source row", () => {
    const text = [
      "3. 구성성분의 명칭 및 함유량",
      "Acetone 67-64-1 30~60%",
      "Toluene 108-88-3 <1%",
      "4. 응급조치 요령"
    ].join("\n");

    expect(extractSection3Rows(text)).toMatchObject([
      {
        rowIndex: 0,
        casNoCandidate: "67-64-1",
        chemicalNameCandidate: "Acetone",
        contentMinCandidate: "30",
        contentMaxCandidate: "60"
      },
      {
        rowIndex: 1,
        casNoCandidate: "108-88-3",
        chemicalNameCandidate: "Toluene",
        contentSingleCandidate: "<1"
      }
    ]);
  });

  it("uses wrapped chemical-name lines before CAS-only concentration rows", () => {
    const text = [
      "3. 구성성분의 명칭 및 조성",
      "화학물질명 관용명 및 이명 CAS번호 함유량% (w/w)",
      "Poly(dimethylsiloxane),",
      "hydroxyl-terminated",
      "70131-67-8 30 ~ 40",
      "Hydrotreated middle",
      "petroleum distillates",
      "64742-46-7 20~ 30",
      "10,10-Oxydiphenoxarsine 58-36-6 0.1 ~ 1",
      "철 Iron 7439-89-6 65-75",
      "4. 응급처치요령"
    ].join("\n");

    expect(extractSection3Rows(text)).toMatchObject([
      {
        casNoCandidate: "70131-67-8",
        chemicalNameCandidate: "Poly(dimethylsiloxane), hydroxyl-terminated",
        contentMinCandidate: "30",
        contentMaxCandidate: "40"
      },
      {
        casNoCandidate: "64742-46-7",
        chemicalNameCandidate: "Hydrotreated middle petroleum distillates",
        contentMinCandidate: "20",
        contentMaxCandidate: "30"
      },
      {
        casNoCandidate: "58-36-6",
        chemicalNameCandidate: "10,10-Oxydiphenoxarsine",
        contentMinCandidate: "0.1",
        contentMaxCandidate: "1"
      },
      {
        casNoCandidate: "7439-89-6",
        chemicalNameCandidate: "철 Iron",
        contentMinCandidate: "65",
        contentMaxCandidate: "75"
      }
    ]);
  });
});
