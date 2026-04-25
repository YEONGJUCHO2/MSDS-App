import { describe, expect, it } from "vitest";
import { classifyPdfTextLayer } from "../../server/services/scanDetector";

describe("scan detector", () => {
  it("marks low-text PDFs as OCR-needed instead of returning blank extraction", () => {
    expect(classifyPdfTextLayer("   \n", 3)).toEqual({
      status: "scan_detected",
      needsOcr: true,
      reason: "텍스트 레이어가 거의 없어 스캔본으로 판단됩니다."
    });
  });

  it("marks text PDFs as parseable when enough text exists", () => {
    const text = "1. 화학제품과 회사에 관한 정보\n제품명 A세척제\n3. 구성성분 CAS 67-64-1 Acetone 30~60%";
    expect(classifyPdfTextLayer(text, 1).status).toBe("text_layer_detected");
  });
});
