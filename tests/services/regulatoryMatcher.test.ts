import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { migrate } from "../../server/db/schema";
import { insertComponentRows, insertDocument, updateComponentReviewStatus, upsertWatchlist } from "../../server/db/repositories";
import { importRegulatorySeedCsv } from "../../server/importers/regulatorySeedImport";
import { matchAndStoreRegulatoryData, recheckComponentRegulatoryData, recheckDocumentRegulatoryData, recheckWatchlistRegulatoryData } from "../../server/services/regulatoryMatcher";

describe("regulatory matcher", () => {
  beforeEach(() => {
    process.env.KOSHA_LAW_API_BASE_URL = "false";
  });

  afterEach(() => {
    delete process.env.KECO_CHEM_API_URL;
    delete process.env.KECO_API_SERVICE_KEY;
    delete process.env.KOSHA_MSDS_API_URL;
    delete process.env.KOSHA_API_SERVICE_KEY;
    delete process.env.KOSHA_LAW_API_BASE_URL;
    vi.unstubAllGlobals();
  });

  it("stores seed matches and watchlist rows by CAS No.", async () => {
    const db = new Database(":memory:");
    migrate(db);
    insertDocument(db, { documentId: "doc-1", fileName: "sample.pdf", fileHash: "hash", storagePath: "", status: "needs_review" });
    insertComponentRows(db, "doc-1", [{
      rowId: "row-1",
      rowIndex: 0,
      rawRowText: "Acetone 67-64-1",
      casNoCandidate: "67-64-1",
      chemicalNameCandidate: "Acetone",
      contentMinCandidate: "",
      contentMaxCandidate: "",
      contentSingleCandidate: "",
      contentText: "",
      confidence: 0.82,
      evidenceLocation: "SECTION 3 / row 1",
      reviewStatus: "needs_review"
    }]);
    importRegulatorySeedCsv(db, [
      "category,cas_no,chemical_name_ko,chemical_name_en,synonyms,threshold_text,period_value,period_unit,source_name,source_url,source_revision_date,note",
      "specialHealthExam,67-64-1,아세톤,Acetone,,특수검진 후보,12,개월,내부 기준표,internal://seed,2026-04-25,검수 필요"
    ].join("\n"));

    const result = await matchAndStoreRegulatoryData(db, "doc-1", [
      { rowId: "row-1", casNoCandidate: "67-64-1", chemicalNameCandidate: "Acetone" }
    ]);

    expect(result).toEqual([{ rowId: "row-1", seedMatches: 1, apiMatches: 0, status: "internal_seed_matched" }]);
    expect(db.prepare("SELECT cas_no AS casNo, source_type AS sourceType FROM regulatory_matches").all()).toEqual([
      { casNo: "67-64-1", sourceType: "internal_seed" }
    ]);
    expect(db.prepare("SELECT cas_no AS casNo, chemical_name AS chemicalName FROM watchlist").all()).toEqual([
      { casNo: "67-64-1", chemicalName: "Acetone" }
    ]);
  });

  it("rechecks a component without duplicating previous matches", async () => {
    const db = new Database(":memory:");
    migrate(db);
    insertDocument(db, { documentId: "doc-1", fileName: "sample.pdf", fileHash: "hash", storagePath: "", status: "needs_review" });
    insertComponentRows(db, "doc-1", [{
      rowId: "row-1",
      rowIndex: 0,
      rawRowText: "Acetone 67-64-1",
      casNoCandidate: "67-64-1",
      chemicalNameCandidate: "Acetone",
      contentMinCandidate: "",
      contentMaxCandidate: "",
      contentSingleCandidate: "",
      contentText: "",
      confidence: 0.82,
      evidenceLocation: "SECTION 3 / row 1",
      reviewStatus: "needs_review"
    }]);
    importRegulatorySeedCsv(db, [
      "category,cas_no,chemical_name_ko,chemical_name_en,synonyms,threshold_text,period_value,period_unit,source_name,source_url,source_revision_date,note",
      "specialHealthExam,67-64-1,아세톤,Acetone,,특수검진 후보,12,개월,내부 기준표,internal://seed,2026-04-25,검수 필요"
    ].join("\n"));

    await recheckComponentRegulatoryData(db, "doc-1", "row-1");
    await recheckComponentRegulatoryData(db, "doc-1", "row-1");

    expect(db.prepare("SELECT COUNT(*) AS count FROM regulatory_matches").get()).toEqual({ count: 1 });
  });

  it("rechecks every component in a selected MSDS document", async () => {
    const db = new Database(":memory:");
    migrate(db);
    insertDocument(db, { documentId: "doc-1", fileName: "sample.pdf", fileHash: "hash", storagePath: "", status: "needs_review" });
    insertComponentRows(db, "doc-1", [
      {
        rowId: "row-1",
        rowIndex: 0,
        rawRowText: "Acetone 67-64-1",
        casNoCandidate: "67-64-1",
        chemicalNameCandidate: "Acetone",
        contentMinCandidate: "",
        contentMaxCandidate: "",
        contentSingleCandidate: "",
        contentText: "",
        confidence: 0.82,
        evidenceLocation: "SECTION 3 / row 1",
        reviewStatus: "needs_review"
      },
      {
        rowId: "row-2",
        rowIndex: 1,
        rawRowText: "Water 7732-18-5",
        casNoCandidate: "7732-18-5",
        chemicalNameCandidate: "Water",
        contentMinCandidate: "",
        contentMaxCandidate: "",
        contentSingleCandidate: "",
        contentText: "",
        confidence: 0.82,
        evidenceLocation: "SECTION 3 / row 2",
        reviewStatus: "needs_review"
      }
    ]);
    importRegulatorySeedCsv(db, [
      "category,cas_no,chemical_name_ko,chemical_name_en,synonyms,threshold_text,period_value,period_unit,source_name,source_url,source_revision_date,note",
      "specialHealthExam,67-64-1,아세톤,Acetone,,특수검진 후보,12,개월,내부 기준표,internal://seed,2026-04-25,검수 필요"
    ].join("\n"));

    const result = await recheckDocumentRegulatoryData(db, "doc-1");

    expect(result).toMatchObject({ documentId: "doc-1", checkedRows: 2, matchedRows: 1 });
    expect(db.prepare("SELECT row_id AS rowId, regulatory_match_status AS status FROM components ORDER BY row_id").all()).toEqual([
      { rowId: "row-1", status: "internal_seed_matched" },
      { rowId: "row-2", status: "api_key_required" }
    ]);
  });

  it("rechecks selected watchlist rows and records the latest lookup result", async () => {
    const db = new Database(":memory:");
    migrate(db);
    upsertWatchlist(db, {
      casNo: "67-64-1",
      chemicalName: "Acetone",
      sourceName: "조회 대기",
      status: "no_match",
      checkedAt: "2026-04-01T00:00:00.000Z"
    });
    importRegulatorySeedCsv(db, [
      "category,cas_no,chemical_name_ko,chemical_name_en,synonyms,threshold_text,period_value,period_unit,source_name,source_url,source_revision_date,note",
      "specialHealthExam,67-64-1,아세톤,Acetone,,특수검진 후보,12,개월,내부 기준표,internal://seed,2026-04-25,검수 필요"
    ].join("\n"));
    const watchId = (db.prepare("SELECT watch_id AS watchId FROM watchlist").get() as { watchId: string }).watchId;

    const result = await recheckWatchlistRegulatoryData(db, [watchId]);

    expect(result).toMatchObject([
      {
        watchId,
        casNo: "67-64-1",
        seedMatches: 1,
        apiMatches: 0,
        status: "internal_seed_matched",
        sourceName: "내부 기준표",
        changed: true
      }
    ]);
    expect(db.prepare("SELECT status, last_source_name AS lastSourceName, last_checked_at AS lastCheckedAt FROM watchlist").get()).toMatchObject({
      status: "internal_seed_matched",
      lastSourceName: "내부 기준표"
    });
    expect((db.prepare("SELECT last_checked_at AS lastCheckedAt FROM watchlist").get() as { lastCheckedAt: string }).lastCheckedAt).not.toBe("2026-04-01T00:00:00.000Z");
  });

  it("stores KOSHA official matches when KECO has no match", async () => {
    const db = new Database(":memory:");
    migrate(db);
    process.env.KOSHA_MSDS_API_URL = "https://msds.kosha.or.kr/openapi/service/msdschem/chemlist";
    process.env.KOSHA_API_SERVICE_KEY = "service-key";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      text: async () => [
        '<?xml version="1.0" encoding="UTF-8"?>',
        "<response>",
        "<header><resultCode>00</resultCode><resultMsg>NORMAL SERVICE.</resultMsg></header>",
        "<body><items><item>",
        "<casNo>12604-53-4</casNo>",
        "<chemId>003180</chemId>",
        "<chemNameKor>페로망가니즈(페로망간)</chemNameKor>",
        "<keNo>KE-13738</keNo>",
        "<lastDate>2024-11-01T00:00:00+09:00</lastDate>",
        "</item></items></body>",
        "</response>"
      ].join("")
    }));
    insertDocument(db, { documentId: "doc-1", fileName: "sample.pdf", fileHash: "hash", storagePath: "", status: "needs_review" });
    insertComponentRows(db, "doc-1", [{
      rowId: "row-1",
      rowIndex: 0,
      rawRowText: "Ferro Manganese 12604-53-4 1~5%",
      casNoCandidate: "12604-53-4",
      chemicalNameCandidate: "Ferro Manganese",
      contentMinCandidate: "1",
      contentMaxCandidate: "5",
      contentSingleCandidate: "",
      contentText: "1~5",
      confidence: 0.82,
      evidenceLocation: "SECTION 3 / row 1",
      reviewStatus: "needs_review"
    }]);

    const result = await matchAndStoreRegulatoryData(db, "doc-1", [
      { rowId: "row-1", casNoCandidate: "12604-53-4", chemicalNameCandidate: "Ferro Manganese" }
    ]);

    expect(result).toEqual([{ rowId: "row-1", seedMatches: 0, apiMatches: 1, status: "official_api_matched" }]);
    expect(db.prepare("SELECT source_name AS sourceName, evidence_text AS evidenceText FROM regulatory_matches").get()).toEqual({
      sourceName: "KOSHA MSDS Open API",
      evidenceText: "페로망가니즈(페로망간) / 12604-53-4 / KE-13738 / 2024-11-01T00:00:00+09:00"
    });
  });

  it("continues with KOSHA lookup when KECO is temporarily rate limited", async () => {
    const db = new Database(":memory:");
    migrate(db);
    process.env.KECO_CHEM_API_URL = "https://example.test/keco";
    process.env.KECO_API_SERVICE_KEY = "service-key";
    process.env.KOSHA_MSDS_API_URL = "https://msds.kosha.or.kr/openapi/service/msdschem/chemlist";
    process.env.KOSHA_API_SERVICE_KEY = "service-key";
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("example.test/keco")) {
        return { ok: false, status: 429, text: async () => "rate limited" };
      }
      return {
        ok: true,
        text: async () => [
          '<?xml version="1.0" encoding="UTF-8"?>',
          "<response>",
          "<header><resultCode>00</resultCode><resultMsg>NORMAL SERVICE.</resultMsg></header>",
          "<body><items><item>",
          "<casNo>12604-53-4</casNo>",
          "<chemNameKor>페로망가니즈(페로망간)</chemNameKor>",
          "<keNo>KE-13738</keNo>",
          "<lastDate>2024-11-01T00:00:00+09:00</lastDate>",
          "</item></items></body>",
          "</response>"
        ].join("")
      };
    }));
    insertDocument(db, { documentId: "doc-1", fileName: "sample.pdf", fileHash: "hash", storagePath: "", status: "needs_review" });
    insertComponentRows(db, "doc-1", [{
      rowId: "row-1",
      rowIndex: 0,
      rawRowText: "Ferro Manganese 12604-53-4 1~5%",
      casNoCandidate: "12604-53-4",
      chemicalNameCandidate: "Ferro Manganese",
      contentMinCandidate: "1",
      contentMaxCandidate: "5",
      contentSingleCandidate: "",
      contentText: "1~5",
      confidence: 0.82,
      evidenceLocation: "SECTION 3 / row 1",
      reviewStatus: "needs_review"
    }]);

    const result = await matchAndStoreRegulatoryData(db, "doc-1", [
      { rowId: "row-1", casNoCandidate: "12604-53-4", chemicalNameCandidate: "Ferro Manganese" }
    ]);

    expect(result).toEqual([{ rowId: "row-1", seedMatches: 0, apiMatches: 1, status: "official_api_matched" }]);
    expect(db.prepare("SELECT source_name AS sourceName FROM regulatory_matches").get()).toEqual({
      sourceName: "KOSHA MSDS Open API"
    });
  });

  it("stores KOSHA material regulation check marks even when KECO already matched the CAS No.", async () => {
    const db = new Database(":memory:");
    migrate(db);
    process.env.KECO_CHEM_API_URL = "https://example.test/keco";
    process.env.KECO_API_SERVICE_KEY = "service-key";
    process.env.KOSHA_LAW_API_BASE_URL = "https://msds.kosha.or.kr/MSDSInfo/kcic";
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("example.test/keco")) {
        return {
          ok: true,
          text: async () => JSON.stringify({
            header: { resultCode: "200", resultMsg: "NORMAL SERVICE." },
            body: {
              items: [{
                casNo: "630-08-0",
                chemNmKor: "일산화탄소",
                typeList: [{ sbstnClsfTypeNm: "사고대비물질", unqNo: "V-12" }]
              }]
            }
          })
        };
      }
      if (url.endsWith("/msdssearchLaw.do")) {
        return {
          ok: true,
          text: async () => "<tr><td><a href=\"javascript:getDetail('law','001008','');\">일산화탄소</a></td><td>630-08-0</td></tr>"
        };
      }
      return {
        ok: true,
        text: async () => JSON.stringify({
          resultLawDetail2: { H0202PERMIT_CNT: 1, PERMIT_CNT: 1 },
          resultLawDetail3: { CNT: 1 },
          resultLawDetail4: { CNT: 0 },
          resultLawDetail5: null,
          resultLawDetail: [
            { ITEM_DETAIL: "10202", MAX_MIN_DIV: "작업환경측정대상물질", MAX_VALUE: "6개월", MAX_UNIT: null },
            { ITEM_DETAIL: "10204", MAX_MIN_DIV: "관리대상유해물질", MAX_VALUE: null, MAX_UNIT: null },
            { ITEM_DETAIL: "10210", MAX_MIN_DIV: "특수건강진단대상물질", MAX_VALUE: "12개월", MAX_UNIT: null },
            { ITEM_DETAIL: "10402", MAX_MIN_DIV: "사고대비물질", MAX_VALUE: null, MAX_UNIT: null },
            { ITEM_DETAIL: "10516", MAX_MIN_DIV: "중점관리물질", MAX_VALUE: null, MAX_UNIT: null }
          ]
        })
      };
    }));
    insertDocument(db, { documentId: "doc-1", fileName: "sample.pdf", fileHash: "hash", storagePath: "", status: "needs_review" });
    insertComponentRows(db, "doc-1", [{
      rowId: "row-1",
      rowIndex: 0,
      rawRowText: "Carbon monoxide 630-08-0 1~5%",
      casNoCandidate: "630-08-0",
      chemicalNameCandidate: "Carbon monoxide",
      contentMinCandidate: "1",
      contentMaxCandidate: "5",
      contentSingleCandidate: "",
      contentText: "1~5",
      confidence: 0.82,
      evidenceLocation: "SECTION 3 / row 1",
      reviewStatus: "needs_review"
    }]);

    const result = await matchAndStoreRegulatoryData(db, "doc-1", [
      { rowId: "row-1", casNoCandidate: "630-08-0", chemicalNameCandidate: "Carbon monoxide" }
    ]);

    expect(result).toEqual([{ rowId: "row-1", seedMatches: 0, apiMatches: 11, status: "official_api_matched" }]);
    expect(db.prepare("SELECT category, source_name AS sourceName FROM regulatory_matches ORDER BY category, source_name").all()).toEqual([
      { category: "accidentPreparedness", sourceName: "KOSHA 물질규제정보" },
      { category: "accidentPreparedness", sourceName: "한국환경공단 화학물질 정보 조회 서비스" },
      { category: "chemicalInfoLookup", sourceName: "한국환경공단 화학물질 정보 조회 서비스" },
      { category: "controlledHazardous", sourceName: "KOSHA 물질규제정보" },
      { category: "existingChemical", sourceName: "KOSHA 물질규제정보" },
      { category: "exposureLimit", sourceName: "KOSHA 물질규제정보" },
      { category: "officialMsdsLawLookup", sourceName: "KOSHA 물질규제정보" },
      { category: "permissibleLimit", sourceName: "KOSHA 물질규제정보" },
      { category: "priorityControl", sourceName: "KOSHA 물질규제정보" },
      { category: "specialHealthExam", sourceName: "KOSHA 물질규제정보" },
      { category: "workEnvironmentMeasurement", sourceName: "KOSHA 물질규제정보" }
    ]);
  });

  it("resolves common Korean chemical names to CAS numbers before official API matching", async () => {
    const db = new Database(":memory:");
    migrate(db);
    process.env.KECO_CHEM_API_URL = "https://example.test/keco";
    process.env.KECO_API_SERVICE_KEY = "service-key";
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      const requestedUrl = new URL(url);
      expect(requestedUrl.searchParams.get("searchGubun")).toBe("2");
      expect(requestedUrl.searchParams.get("searchNm")).toBe("1344-28-1");
      return {
        ok: true,
        text: async () => JSON.stringify({
          header: { resultCode: "200", resultMsg: "NORMAL SERVICE." },
          body: {
            items: [{
              casNo: "1344-28-1",
              sbstnNmEng: "Aluminium oxide; Alumina",
              korexst: "KE-01012",
              typeList: [{ sbstnClsfTypeNm: "기존화학물질", unqNo: "KE-01012" }]
            }]
          }
        })
      };
    }));
    insertDocument(db, { documentId: "doc-1", fileName: "resac.pdf", fileHash: "hash", storagePath: "", status: "needs_review" });
    insertComponentRows(db, "doc-1", [{
      rowId: "row-1",
      rowIndex: 0,
      rawRowText: "산화 알루미늄 20~30",
      casNoCandidate: "",
      chemicalNameCandidate: "산화 알루미늄",
      contentMinCandidate: "20",
      contentMaxCandidate: "30",
      contentSingleCandidate: "",
      contentText: "20~30",
      confidence: 0.62,
      evidenceLocation: "SECTION 3 / row 1",
      reviewStatus: "needs_review"
    }]);

    const result = await matchAndStoreRegulatoryData(db, "doc-1", [
      { rowId: "row-1", casNoCandidate: "", chemicalNameCandidate: "산화 알루미늄" }
    ]);

    expect(result).toEqual([{ rowId: "row-1", seedMatches: 0, apiMatches: 2, status: "official_api_matched" }]);
    expect(db.prepare("SELECT cas_no_candidate AS casNoCandidate, regulatory_match_status AS regulatoryMatchStatus FROM components").get()).toEqual({
      casNoCandidate: "1344-28-1",
      regulatoryMatchStatus: "official_api_matched"
    });
    expect(db.prepare("SELECT ai_review_status AS aiReviewStatus, ai_review_note AS aiReviewNote FROM components").get()).toEqual({
      aiReviewStatus: "ai_candidate",
      aiReviewNote: "물질명으로 CAS No.를 자동 보강했고 공식 API 조회가 완료되었습니다."
    });
    expect(db.prepare("SELECT cas_no AS casNo, category, source_type AS sourceType FROM regulatory_matches ORDER BY category").all()).toEqual([
      { casNo: "1344-28-1", category: "chemicalInfoLookup", sourceType: "official_api" },
      { casNo: "1344-28-1", category: "existingChemical", sourceType: "official_api" }
    ]);
  });

  it("updates component and queue review status together", () => {
    const db = new Database(":memory:");
    migrate(db);
    insertDocument(db, { documentId: "doc-1", fileName: "sample.pdf", fileHash: "hash", storagePath: "", status: "needs_review" });
    insertComponentRows(db, "doc-1", [{
      rowId: "row-1",
      rowIndex: 0,
      rawRowText: "Acetone 67-64-1",
      casNoCandidate: "67-64-1",
      chemicalNameCandidate: "Acetone",
      contentMinCandidate: "",
      contentMaxCandidate: "",
      contentSingleCandidate: "",
      contentText: "",
      confidence: 0.82,
      evidenceLocation: "SECTION 3 / row 1",
      reviewStatus: "needs_review"
    }]);

    updateComponentReviewStatus(db, "row-1", "approved");

    expect(db.prepare("SELECT review_status AS reviewStatus FROM components").get()).toEqual({ reviewStatus: "approved" });
    expect(db.prepare("SELECT review_status AS reviewStatus FROM review_queue").get()).toEqual({ reviewStatus: "approved" });
  });

  it("updates legacy queue rows that were created before entity ids existed", () => {
    const db = new Database(":memory:");
    migrate(db);
    insertDocument(db, { documentId: "doc-1", fileName: "sample.pdf", fileHash: "hash", storagePath: "", status: "needs_review" });
    insertComponentRows(db, "doc-1", [{
      rowId: "row-1",
      rowIndex: 0,
      rawRowText: "Acetone 67-64-1",
      casNoCandidate: "67-64-1",
      chemicalNameCandidate: "Acetone",
      contentMinCandidate: "",
      contentMaxCandidate: "",
      contentSingleCandidate: "",
      contentText: "",
      confidence: 0.82,
      evidenceLocation: "SECTION 3 / row 1",
      reviewStatus: "needs_review"
    }]);
    db.prepare("UPDATE review_queue SET entity_id = ''").run();

    updateComponentReviewStatus(db, "row-1", "excluded");

    expect(db.prepare("SELECT entity_id AS entityId, review_status AS reviewStatus FROM review_queue").get()).toEqual({
      entityId: "row-1",
      reviewStatus: "excluded"
    });
  });
});
