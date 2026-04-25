import { describe, expect, it } from "vitest";
import { normalizeUploadedFileName } from "../../server/services/fileName";

describe("file name normalization", () => {
  it("repairs UTF-8 Korean names decoded as latin1 by multipart middleware", () => {
    const mojibake = Buffer.from("한글_MSDS.pdf", "utf8").toString("latin1");

    expect(normalizeUploadedFileName(mojibake)).toBe("한글_MSDS.pdf");
  });

  it("keeps readable ASCII names unchanged", () => {
    expect(normalizeUploadedFileName("sample-msds.pdf")).toBe("sample-msds.pdf");
  });
});
