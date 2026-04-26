import crypto from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createDocumentStorage, resolveDocumentStorageProvider } from "../../server/storage/documentStorage";

describe("document storage provider", () => {
  it("uses local storage by default", () => {
    expect(resolveDocumentStorageProvider({})).toBe("local");
  });

  it("uses Supabase storage only when explicitly selected", () => {
    expect(resolveDocumentStorageProvider({ MSDS_STORAGE_PROVIDER: "supabase" })).toBe("supabase");
  });

  it("rejects Supabase storage without required server secrets", () => {
    expect(() => createDocumentStorage({
      MSDS_STORAGE_PROVIDER: "supabase",
      SUPABASE_URL: "https://example.supabase.co"
    })).toThrow("SUPABASE_SERVICE_ROLE_KEY is required");
  });

  it("saves local documents inside the uploads directory with a sha256 hash", async () => {
    const cwd = process.cwd();
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "msds-storage-"));
    process.chdir(tempDir);
    try {
      const storage = createDocumentStorage({});
      const buffer = Buffer.from("sample msds");

      const result = await storage.save({
        documentId: "doc-1",
        fileName: "sample.pdf",
        buffer
      });

      const uploadsDir = path.resolve(process.cwd(), "storage", "uploads");
      expect(result.storagePath.startsWith(`${uploadsDir}${path.sep}`)).toBe(true);
      expect(path.basename(result.storagePath)).toBe("doc-1-sample.pdf");
      expect(result.fileHash).toBe(crypto.createHash("sha256").update(buffer).digest("hex"));
    } finally {
      process.chdir(cwd);
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("rejects local document filenames with path separators", async () => {
    const storage = createDocumentStorage({});

    await expect(storage.save({
      documentId: "doc-1",
      fileName: "../escape.pdf",
      buffer: Buffer.from("sample msds")
    })).rejects.toThrow("Document filename cannot contain path separators.");

    await expect(storage.save({
      documentId: "doc-1",
      fileName: "..\\escape.pdf",
      buffer: Buffer.from("sample msds")
    })).rejects.toThrow("Document filename cannot contain path separators.");
  });
});
