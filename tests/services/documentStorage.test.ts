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
});
