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

  it("marks readable PDFs that yield no component rows as manual review instead of success", async () => {
    const db = new Database(":memory:");
    migrate(db);
    const result = await processExtractedText(db, {
      documentId: "doc-empty",
      fileName: "broken-text-layer.pdf",
      text: Array.from({ length: 12 }, (_, index) => `제품명 DR.99 ${index} Date of issue: 2005-02-23 Revision date: 2025-08-08 Version: 11 자료없음`).join("\n"),
      pageCount: 9
    });

    expect(result).toMatchObject({
      documentId: "doc-empty",
      status: "manual_input_required",
      componentRows: [],
      message: "성분 후보를 자동 추출하지 못했습니다. PDF 텍스트/표 구조를 확인하거나 수동 입력이 필요합니다."
    });
    expect(db.prepare("SELECT status FROM documents WHERE document_id = ?").get("doc-empty")).toEqual({ status: "manual_input_required" });
  });

  it("uses OCR text when the PDF text layer is too short", async () => {
    const db = new Database(":memory:");
    migrate(db);
    const ocrAdapter = {
      recognize: vi.fn().mockResolvedValue({
        status: "ocr_completed" as const,
        text: "3. 구성성분의 명칭 및 함유량\nAcetone 67-64-1 30~60\n4. 응급조치 요령",
        confidence: 91,
        message: "OCR 후보 텍스트를 생성했습니다."
      })
    };

    const result = await processExtractedText(db, {
      documentId: "doc-ocr",
      fileName: "scan.pdf",
      text: "too short",
      pageCount: 5,
      pdfBuffer: Buffer.from("pdf"),
      ocrAdapter
    });

    expect(ocrAdapter.recognize).toHaveBeenCalledWith(Buffer.from("pdf"));
    expect(result.status).toBe("needs_review");
    expect(result.componentRows).toHaveLength(1);
    expect(db.prepare("SELECT status, text_content AS textContent FROM documents WHERE document_id = ?").get("doc-ocr")).toEqual({
      status: "needs_review",
      textContent: "3. 구성성분의 명칭 및 함유량\nAcetone 67-64-1 30~60\n4. 응급조치 요령"
    });
  });

  it("uses OCR as a fallback when the text layer has no component rows", async () => {
    const db = new Database(":memory:");
    migrate(db);
    const ocrAdapter = {
      recognize: vi.fn().mockResolvedValue({
        status: "ocr_completed" as const,
        text: "3. 구성성분의 명칭 및 함유량\nToluene 108-88-3 10~20\n4. 응급조치 요령",
        confidence: 88,
        message: "OCR 후보 텍스트를 생성했습니다."
      })
    };

    const result = await processExtractedText(db, {
      documentId: "doc-broken-text",
      fileName: "broken-text.pdf",
      text: Array.from({ length: 12 }, (_, index) => `깨진 텍스트 ${index} 자료없음`).join("\n"),
      pageCount: 4,
      pdfBuffer: Buffer.from("pdf"),
      ocrAdapter
    });

    expect(ocrAdapter.recognize).toHaveBeenCalledTimes(1);
    expect(result.status).toBe("needs_review");
    expect(result.componentRows[0]).toMatchObject({
      casNoCandidate: "108-88-3",
      chemicalNameCandidate: "Toluene"
    });
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
