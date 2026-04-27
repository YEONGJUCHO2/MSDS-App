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

      const imageInputs = await prepareOcrImages(input);
      const { createWorker } = await import("tesseract.js");
      const cachePath = await ensureOcrCachePath();
      const worker = await createWorker("kor+eng", 1, { cachePath });
      try {
        const results = [];
        for (const imageInput of imageInputs) {
          results.push(await worker.recognize(imageInput));
        }
        const text = results.map((result) => result.data.text).join("\n").trim();
        const confidence = Math.round(
          results.reduce((sum, result) => sum + result.data.confidence, 0) / Math.max(results.length, 1)
        );
        return {
          status: confidence >= 65 ? "ocr_completed" : "ocr_low_confidence",
          text,
          confidence,
          message: confidence >= 65 ? "OCR 후보 텍스트를 생성했습니다." : "OCR 신뢰도가 낮아 원문 대조 확인이 필요합니다."
        };
      } finally {
        await worker.terminate();
      }
    }
  };
}

async function prepareOcrImages(input: Buffer) {
  if (!isPdf(input)) return [input];

  const { createCanvas } = await import("@napi-rs/canvas");
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(input),
    disableWorker: true,
    useSystemFonts: true
  } as object);
  const pdf = await loadingTask.promise;
  const maxPages = clampPositiveInteger(process.env.MSDS_OCR_MAX_PAGES, 6);
  const scale = clampPositiveNumber(process.env.MSDS_OCR_SCALE, 2);
  const images: Buffer[] = [];

  try {
    for (let pageNumber = 1; pageNumber <= Math.min(pdf.numPages, maxPages); pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale });
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      const canvasContext = canvas.getContext("2d");
      await page.render({
        canvas: canvas as unknown as HTMLCanvasElement,
        canvasContext: canvasContext as unknown as CanvasRenderingContext2D,
        viewport
      }).promise;
      images.push(canvas.toBuffer("image/png"));
      page.cleanup();
    }
  } finally {
    await loadingTask.destroy();
  }

  return images.length > 0 ? images : [input];
}

function isPdf(input: Buffer) {
  return input.subarray(0, 5).toString("ascii") === "%PDF-";
}

function clampPositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function clampPositiveNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function ensureOcrCachePath() {
  const cachePath = process.env.MSDS_OCR_CACHE_PATH || (process.env.VERCEL ? "/tmp/msds-ocr-cache" : "storage/ocr-cache");
  const { mkdir } = await import("node:fs/promises");
  await mkdir(cachePath, { recursive: true });
  return cachePath;
}
