export interface OcrResult {
  status: "ocr_completed" | "ocr_low_confidence" | "manual_input_required";
  text: string;
  confidence: number;
  message: string;
}

export interface OcrAdapter {
  recognize(input: Buffer): Promise<OcrResult>;
}

export function createOcrAdapter(options: { enabled: boolean }): OcrAdapter {
  return {
    async recognize(input: Buffer) {
      if (!options.enabled) {
        return {
          status: "manual_input_required",
          text: "",
          confidence: 0,
          message: "OCR이 비활성화되어 수동입력 또는 공급사 텍스트 PDF 요청이 필요합니다."
        };
      }

      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("kor+eng");
      try {
        const result = await worker.recognize(input);
        const confidence = Math.round(result.data.confidence);
        return {
          status: confidence >= 65 ? "ocr_completed" : "ocr_low_confidence",
          text: result.data.text,
          confidence,
          message: confidence >= 65 ? "OCR 후보 텍스트를 생성했습니다." : "OCR 신뢰도가 낮아 원문 대조 확인이 필요합니다."
        };
      } finally {
        await worker.terminate();
      }
    }
  };
}
