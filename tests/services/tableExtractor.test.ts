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

  it("prefers the primary hydrogen name over noisy synonym aliases", () => {
    const text = [
      "3. 구성성분의 명칭 및 함유량",
      "화학물질명 이명(관용명) CAS번호 함유량(%)",
      "수소",
      "오르토수소; 파라수소; 다이하이드로젠; 하이드로젠",
      "1333-74-0 99.9",
      "4. 응급조치 요령"
    ].join("\n");

    expect(extractSection3Rows(text)).toMatchObject([
      {
        casNoCandidate: "1333-74-0",
        chemicalNameCandidate: "수소",
        contentSingleCandidate: "99.9"
      }
    ]);
  });

  it("trims synonym lists from same-line chemical names", () => {
    const text = [
      "3. 구성성분의 명칭 및 함유량",
      "화학물질명 관용명 및 이명 CAS 번호 또는 식별번호 함유량(%)",
      "질소 나이트로젠, 엘리멘탈 ; 다이아진 ; 다이나이트로젠 7727-37-9 0 ~ 1",
      "Hydrogen orthohydrogen; parahydrogen; dihydrogen 1333-74-0 90 ~ 100",
      "4. 응급조치 요령"
    ].join("\n");

    expect(extractSection3Rows(text)).toMatchObject([
      {
        casNoCandidate: "7727-37-9",
        chemicalNameCandidate: "질소",
        contentMinCandidate: "0",
        contentMaxCandidate: "1"
      },
      {
        casNoCandidate: "1333-74-0",
        chemicalNameCandidate: "Hydrogen",
        contentMinCandidate: "90",
        contentMaxCandidate: "100"
      }
    ]);
  });

  it("extracts Korean section 3 rows that omit CAS numbers", () => {
    const text = [
      "3. 구성성분의 명칭 및 함유량(Composion Information on Ingredents)",
      "물질명 함유량(%)",
      "산화 알루미늄 20~30",
      "산화규소(비결정체 규조토) 65~75",
      "산화 철(IRON OXIDE) 1~5",
      "기타 1~5",
      "4. 응급조치 요령(First-aid Measures)"
    ].join("\n");

    expect(extractSection3Rows(text)).toMatchObject([
      {
        chemicalNameCandidate: "산화 알루미늄",
        casNoCandidate: "",
        contentMinCandidate: "20",
        contentMaxCandidate: "30"
      },
      {
        chemicalNameCandidate: "산화규소(비결정체 규조토)",
        casNoCandidate: "",
        contentMinCandidate: "65",
        contentMaxCandidate: "75"
      },
      {
        chemicalNameCandidate: "산화 철(IRON OXIDE)",
        casNoCandidate: "",
        contentMinCandidate: "1",
        contentMaxCandidate: "5"
      }
    ]);
  });

  it("keeps section 3 rows when PDF text places the table before its heading", () => {
    const text = [
      "4. 응급조치 요령",
      "(1E)-1-Chloro-3,3,3-trifluoro-1-",
      "propene 자료없음 102687-65-0 / 2015-3-6349 70 ~ 80",
      "Hexadecafluoroheptane 자료없음 335-57-9 / KE-18431 20 ~ 30",
      "질소 나이트로젠, 엘리멘탈 ; 다이아진 ; 다이나이트로젠 ;",
      "다이아토믹 나이트로젠 7727-37-9 / KE-25994 0 ~ 1",
      "3. 구성성분의 명칭 및 함유량",
      "화학물질명 관용명 및 이명 CAS 번호 또는 식별번호 함유량(%)",
      "-- 2 of 10 --"
    ].join("\n");

    expect(extractSection3Rows(text)).toMatchObject([
      {
        chemicalNameCandidate: "(1E)-1-Chloro-3,3,3-trifluoro-1- propene 자료없음",
        casNoCandidate: "102687-65-0",
        contentMinCandidate: "70",
        contentMaxCandidate: "80"
      },
      {
        chemicalNameCandidate: "Hexadecafluoroheptane 자료없음",
        casNoCandidate: "335-57-9",
        contentMinCandidate: "20",
        contentMaxCandidate: "30"
      },
      {
        chemicalNameCandidate: "질소",
        casNoCandidate: "7727-37-9",
        contentMinCandidate: "0",
        contentMaxCandidate: "1"
      }
    ]);
  });

  it("prefers CAS table rows before a misplaced section 3 heading and ignores toxicology prose", () => {
    const text = [
      "이명(관용명) CAS번호 함유량(%)",
      "1305-78-8 2-4",
      "알파-알루미나 1344-28-1 60-70",
      "SILICA 7631-86-9 20-30",
      "4. 응급조치요령",
      "3. 구성성분의 명칭 및 함유량",
      "물질명",
      "산화칼슘",
      "산화 알루미늄",
      "8. 노출방지 및 개인보호구",
      "TWA - 2mg/m3",
      "시험관내 미생물을 이용한 복귀돌연변이시험 유사물질 CAS No. 1317-61-9",
      "최종개정일자 2025-07-30"
    ].join("\n");

    const rows = extractSection3Rows(text);

    expect(rows).toMatchObject([
      {
        casNoCandidate: "1305-78-8",
        contentMinCandidate: "2",
        contentMaxCandidate: "4"
      },
      {
        casNoCandidate: "1344-28-1",
        chemicalNameCandidate: "알파-알루미나",
        contentMinCandidate: "60",
        contentMaxCandidate: "70"
      },
      {
        casNoCandidate: "7631-86-9",
        chemicalNameCandidate: "SILICA",
        contentMinCandidate: "20",
        contentMaxCandidate: "30"
      }
    ]);
    expect(rows.map((row) => row.rawRowText).join("\n")).not.toContain("TWA");
    expect(rows.map((row) => row.casNoCandidate)).not.toContain("1317-61-9");
  });

  it("falls back to known OCR chemical names when section 3 text is noisy", () => {
    const text = [
      "3. 구성성분의 명칭 및 함유량",
      "-테트라플루오.    터",
      "세 ㅣ   별  - ㅣ 66 ’ AEs Re sadn '",
      "4. 응급조치 요령",
      "8. 노출방지 및 개인보호구",
      "- [1,1,1,2-테트라플루오로에테인]: 해당없음"
    ].join("\n");

    expect(extractSection3Rows(text)).toMatchObject([
      {
        chemicalNameCandidate: "1,1,1,2-테트라플루오로에테인",
        casNoCandidate: "811-97-2",
        contentText: "",
        evidenceLocation: "OCR fallback / known chemical 1"
      }
    ]);
  });
});
