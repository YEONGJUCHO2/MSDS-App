import Database from "better-sqlite3";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DocumentRepository } from "../../server/db/documentRepository";
import { migrate } from "../../server/db/schema";
import { processExtractedText, processExtractedTextWithRepository } from "../../server/services/processingPipeline";

describe("processing pipeline", () => {
  afterEach(() => {
    delete process.env.KECO_CHEM_API_URL;
    delete process.env.KECO_API_SERVICE_KEY;
    vi.unstubAllGlobals();
  });

  it("does not queue complete component rows that can proceed to registration output", async () => {
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
    expect(result.message).toBe("1개 성분 후보를 사내 입력 포맷에 반영했습니다. 추가 확인이 필요한 항목은 없습니다.");
    expect(db.prepare("SELECT COUNT(*) AS count FROM review_queue").get()).toEqual({ count: 0 });
  });

  it("can run the core pipeline with an async document repository", async () => {
    const db = new Database(":memory:");
    migrate(db);
    const calls: string[] = [];
    const repo: DocumentRepository = {
      async findDocumentId(documentId) {
        calls.push(`find:${documentId}`);
        return undefined;
      },
      async insertDocument(input) {
        calls.push(`insert:${input.documentId}`);
        return input.documentId ?? "generated-doc";
      },
      async upsertDocumentText(documentId, _textContent, _pageCount, status) {
        calls.push(`text:${documentId}:${status}`);
      },
      async insertComponentRows() {
        throw new Error("scan-only input should not insert component rows");
      },
      async countNeedsReview() {
        throw new Error("scan-only input should not count review queue");
      }
    };

    const result = await processExtractedTextWithRepository(db, repo, {
      documentId: "doc-async",
      fileName: "scan.pdf",
      text: "too short",
      pageCount: 1
    });

    expect(result).toMatchObject({
      documentId: "doc-async",
      status: "manual_input_required"
    });
    expect(calls).toEqual([
      "find:doc-async",
      "insert:doc-async",
      "text:doc-async:scan_detected"
    ]);
  });

  it("queues component rows that need human attention before monitoring", async () => {
    const db = new Database(":memory:");
    migrate(db);
    const result = await processExtractedText(db, {
      documentId: "doc-1",
      fileName: "sample.pdf",
      text: "3. 구성성분의 명칭 및 함유량\nTrade secret 12345-67-8\n4. 응급조치 요령",
      pageCount: 1
    });

    expect(result.status).toBe("needs_review");
    expect(db.prepare("SELECT label, review_status AS reviewStatus FROM review_queue").all()).toEqual([
      { label: "Trade secret / 12345-67-8", reviewStatus: "needs_review" }
    ]);
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
