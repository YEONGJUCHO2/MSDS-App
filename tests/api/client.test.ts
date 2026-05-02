import { afterEach, describe, expect, it, vi } from "vitest";
import { api, resolveApiUrl } from "../../src/api/client";

describe("api client", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("uses same-origin API paths when no production API base URL is configured", () => {
    vi.stubEnv("VITE_API_BASE_URL", "");

    expect(resolveApiUrl("/api/documents")).toBe("/api/documents");
    expect(api.documentFileUrl("doc-1")).toBe("/api/documents/doc-1/file");
  });

  it("routes API requests to the configured backend base URL for Vercel deployments", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://msds-backend.example.com/");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ documents: [] })
    });
    vi.stubGlobal("fetch", fetchMock);

    await api.documents();

    expect(fetchMock).toHaveBeenCalledWith("https://msds-backend.example.com/api/documents", undefined);
  });

  it("requests a backend batch recheck for selected MSDS documents", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        documentCount: 1,
        rowCount: 2,
        results: [{ documentId: "doc-1", checkedRows: 2, matchedRows: 1 }]
      })
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await api.recheckDocuments(["doc-1"]);

    expect(fetchMock).toHaveBeenCalledWith("/api/documents/recheck", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentIds: ["doc-1"] })
    });
    expect(result).toEqual({
      documentCount: 1,
      rowCount: 2,
      results: [{ documentId: "doc-1", checkedRows: 2, matchedRows: 1 }]
    });
  });

  it("renames an MSDS document through PATCH", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ documents: [] })
    });
    vi.stubGlobal("fetch", fetchMock);

    await api.renameDocument("doc-1", "renamed.pdf");

    expect(fetchMock).toHaveBeenCalledWith("/api/documents/doc-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName: "renamed.pdf" })
    });
  });

  it("uploads a replacement MSDS file for a review-needed document", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ documentId: "doc-1", status: "approved", documents: [] })
    });
    vi.stubGlobal("fetch", fetchMock);
    const file = new File(["replacement"], "replacement.pdf", { type: "application/pdf" });

    await api.uploadReplacement("doc-1", file);

    expect(fetchMock).toHaveBeenCalledWith("/api/documents/doc-1/replacement", expect.objectContaining({
      method: "POST",
      body: expect.any(FormData)
    }));
    const form = fetchMock.mock.calls[0][1]?.body as FormData;
    expect(form.get("file")).toBe(file);
  });
});
