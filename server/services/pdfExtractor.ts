export interface PdfExtractionResult {
  text: string;
  pageCount: number;
}

export async function extractPdfText(buffer: Buffer): Promise<PdfExtractionResult> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  const textResult = await parser.getText();
  await parser.destroy();
  return {
    text: textResult.text,
    pageCount: textResult.pages.length
  };
}
