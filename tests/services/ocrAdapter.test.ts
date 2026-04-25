import { describe, expect, it } from "vitest";
import { createOcrAdapter } from "../../server/services/ocrAdapter";

describe("OCR adapter", () => {
  it("returns manual fallback metadata when OCR is disabled", async () => {
    const adapter = createOcrAdapter({ enabled: false });
    await expect(adapter.recognize(Buffer.from("pdf"))).resolves.toEqual({
      status: "manual_input_required",
      text: "",
      confidence: 0,
      message: "OCR이 비활성화되어 수동입력 또는 공급사 텍스트 PDF 요청이 필요합니다."
    });
  });
});
