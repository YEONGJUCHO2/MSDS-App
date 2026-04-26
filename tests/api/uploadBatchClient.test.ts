import { describe, expect, it, vi } from "vitest";
import { api } from "../../src/api/client";

describe("upload batch client", () => {
  it("posts all selected files in one batch request", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      results: [
        { fileName: "first.pdf", documentId: "doc-1", status: "needs_review", message: "완료" },
        { fileName: "second.pdf", documentId: "doc-2", status: "needs_review", message: "완료" }
      ]
    })));

    const files = [
      new File(["first"], "first.pdf", { type: "application/pdf" }),
      new File(["second"], "second.pdf", { type: "application/pdf" })
    ];

    await api.uploadBatch(files);

    expect(fetchMock).toHaveBeenCalledWith("/api/documents/upload-batch", expect.objectContaining({
      method: "POST",
      body: expect.any(FormData)
    }));
    const form = fetchMock.mock.calls[0][1]?.body as FormData;
    expect(form.getAll("files")).toHaveLength(2);
    fetchMock.mockRestore();
  });
});
