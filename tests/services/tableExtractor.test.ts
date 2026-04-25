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
});
