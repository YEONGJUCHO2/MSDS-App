import Database from "better-sqlite3";
import { afterEach, describe, expect, it, vi } from "vitest";
import { migrate } from "../../server/db/schema";
import { processExtractedText } from "../../server/services/processingPipeline";

describe("processing pipeline", () => {
  afterEach(() => {
    delete process.env.KECO_CHEM_API_URL;
    delete process.env.KECO_API_SERVICE_KEY;
    vi.unstubAllGlobals();
  });

  it("creates review queue items from extracted MSDS component rows", async () => {
    const db = new Database(":memory:");
    migrate(db);
    const result = await processExtractedText(db, {
      documentId: "doc-1",
      fileName: "sample.pdf",
      text: "3. 구성성분의 명칭 및 함유량\nAcetone 67-64-1 30~60%\n4. 응급조치 요령",
      pageCount: 1
    });

    expect(result.status).toBe("needs_review");
    expect(result.componentRows).toHaveLength(1);
    expect(db.prepare("SELECT COUNT(*) AS count FROM review_queue").get()).toEqual({ count: 1 });
  });

  it("automatically stores official API classifications during upload processing", async () => {
    const db = new Database(":memory:");
    migrate(db);
    process.env.KECO_CHEM_API_URL = "https://example.test/keco";
    process.env.KECO_API_SERVICE_KEY = "service-key";
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      const requestedUrl = new URL(url);
      const isCorrectKecoCasLookup = requestedUrl.searchParams.get("searchGubun") === "2"
        && requestedUrl.searchParams.get("searchNm") === "96-29-7"
        && requestedUrl.searchParams.get("returnType") === "JSON";
      return {
        ok: true,
        text: async () => JSON.stringify(isCorrectKecoCasLookup
          ? {
              header: { resultCode: "200", resultMsg: "NORMAL SERVICE." },
              body: {
                items: [{
                  casNo: "96-29-7",
                  sbstnNmKor: "메틸 에틸 케톡심",
                  typeList: [{ sbstnClsfTypeNm: "인체등유해성물질", unqNo: "2023-1-1127" }]
                }]
              }
            }
          : { header: { resultCode: "91", resultMsg: "잘못된 파라미터 요청입니다." }, body: null })
      };
    }));

    await processExtractedText(db, {
      documentId: "doc-1",
      fileName: "sample.pdf",
      text: "3. 구성성분의 명칭 및 함유량\nMethylethylketoxime 96-29-7 0.1~1\n4. 응급조치 요령",
      pageCount: 1
    });

    expect(db.prepare("SELECT category, source_type AS sourceType FROM regulatory_matches ORDER BY category").all()).toEqual([
      { category: "chemicalInfoLookup", sourceType: "official_api" },
      { category: "toxic", sourceType: "official_api" }
    ]);
  });
});
