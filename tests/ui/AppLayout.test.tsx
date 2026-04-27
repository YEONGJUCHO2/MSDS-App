import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, vi } from "vitest";
import { describe, expect, it } from "vitest";
import App from "../../src/App";

vi.mock("../../src/api/client", () => ({
  api: {
    documents: vi.fn(),
    queues: vi.fn(),
    uploadBatch: vi.fn()
  }
}));

import { api } from "../../src/api/client";

describe("App layout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.documents).mockResolvedValue({ documents: [] });
    vi.mocked(api.queues).mockResolvedValue({ items: [] });
    vi.mocked(api.uploadBatch).mockResolvedValue({ results: [] });
  });

  it("uses fixed-width navigation and content rails so pages do not resize by tab content", async () => {
    render(<App />);

    expect(await screen.findByTestId("app-shell")).toHaveClass("app-shell");
    expect(screen.getByTestId("app-nav")).toHaveClass("app-nav");
    expect(screen.getByTestId("app-content")).toHaveClass("content");
  });

  it("keeps the upload task visible and alive when navigating away from the upload page", async () => {
    let resolveUpload: (value: Awaited<ReturnType<typeof api.uploadBatch>>) => void = () => undefined;
    vi.mocked(api.uploadBatch).mockReturnValue(new Promise((resolve) => {
      resolveUpload = resolve;
    }));
    render(<App />);
    const files = [
      new File(["first"], "first.pdf", { type: "application/pdf" }),
      new File(["second"], "second.pdf", { type: "application/pdf" })
    ];

    fireEvent.click(screen.getByTitle("업로드"));
    fireEvent.drop(await screen.findByTestId("msds-dropzone"), {
      dataTransfer: { files }
    });

    expect(await screen.findByText("업로드 중 2/20")).toBeInTheDocument();

    fireEvent.click(screen.getByTitle("대시보드"));

    expect(screen.getByText("업로드 중 2/20")).toBeInTheDocument();

    resolveUpload({
      results: [
        { success: true, fileName: "first.pdf", documentId: "doc-1", status: "needs_review", message: "업로드 완료" },
        { success: true, fileName: "second.pdf", documentId: "doc-2", status: "needs_review", message: "업로드 완료" }
      ]
    });

    expect(await screen.findByText("2개 파일 업로드 완료")).toBeInTheDocument();
    await waitFor(() => expect(api.documents).toHaveBeenCalledTimes(3));
  });
});
