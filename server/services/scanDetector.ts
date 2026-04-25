export type PdfTextLayerClassification =
  | { status: "scan_detected"; needsOcr: true; reason: string }
  | { status: "text_layer_detected"; needsOcr: false; reason: string };

export function classifyPdfTextLayer(text: string, pageCount: number): PdfTextLayerClassification {
  const normalized = text.replace(/\s+/g, " ").trim();
  const minCharacters = Math.max(40, pageCount * 25);

  if (normalized.length < minCharacters) {
    return {
      status: "scan_detected",
      needsOcr: true,
      reason: "텍스트 레이어가 거의 없어 스캔본으로 판단됩니다."
    };
  }

  return {
    status: "text_layer_detected",
    needsOcr: false,
    reason: "텍스트 레이어가 감지되어 로컬 파싱을 진행합니다."
  };
}
