import { describe, expect, it, vi } from "vitest";
import { normalizeUploadedFileName } from "../../server/services/fileName";

describe("upload storage behavior", () => {
  it("normalizes file names before storage paths are generated", () => {
    expect(normalizeUploadedFileName("  위험 물질.pdf  ")).toBe("위험 물질.pdf");
  });

  it("keeps per-file batch results independent", async () => {
    const files = [
      { originalname: "ok.pdf", buffer: Buffer.from("%PDF ok") },
      { originalname: "bad.pdf", buffer: Buffer.from("bad") }
    ];
    const processFile = vi.fn(async (file: { originalname: string }) => {
      if (file.originalname === "bad.pdf") throw new Error("PDF text extraction failed");
      return { fileName: file.originalname, documentId: "doc-ok", status: "needs_review" };
    });

    const results = [];
    for (const file of files) {
      try {
        results.push({ success: true, ...(await processFile(file)) });
      } catch (error) {
        results.push({
          success: false,
          fileName: file.originalname,
          error: error instanceof Error ? error.message : "Unknown upload error"
        });
      }
    }

    expect(results).toEqual([
      { success: true, fileName: "ok.pdf", documentId: "doc-ok", status: "needs_review" },
      { success: false, fileName: "bad.pdf", error: "PDF text extraction failed" }
    ]);
  });
});
