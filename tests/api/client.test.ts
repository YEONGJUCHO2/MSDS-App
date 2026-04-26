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
});
