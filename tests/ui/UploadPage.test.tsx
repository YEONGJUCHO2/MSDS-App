import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../src/api/client";
import { UploadPage } from "../../src/pages/UploadPage";

vi.mock("../../src/api/client", () => ({
  api: {
    upload: vi.fn(),
    uploadBatch: vi.fn()
  }
}));

describe("UploadPage", () => {
  beforeEach(() => {
    vi.mocked(api.upload).mockReset();
    vi.mocked(api.uploadBatch).mockReset();
    vi.mocked(api.upload).mockResolvedValue({ documentId: "doc-1", status: "needs_review", message: "업로드 완료" });
    vi.mocked(api.uploadBatch).mockResolvedValue({
      results: [
        { fileName: "first.pdf", documentId: "doc-1", status: "needs_review", message: "업로드 완료" },
        { fileName: "second.pdf", documentId: "doc-2", status: "needs_review", message: "업로드 완료" }
      ]
    });
  });

  it("allows selecting more than one PDF at once", () => {
    render(<UploadPage onUploaded={() => undefined} />);

    expect(screen.getByTestId("msds-file-input")).toHaveAttribute("multiple");
  });

  it("uploads every PDF dropped onto the upload area", async () => {
    const onUploaded = vi.fn();
    render(<UploadPage onUploaded={onUploaded} />);
    const files = [
      new File(["first"], "first.pdf", { type: "application/pdf" }),
      new File(["second"], "second.pdf", { type: "application/pdf" })
    ];

    fireEvent.drop(screen.getByTestId("msds-dropzone"), {
      dataTransfer: { files }
    });

    await waitFor(() => expect(api.uploadBatch).toHaveBeenCalledTimes(1));
    expect(api.uploadBatch).toHaveBeenCalledWith(files);
    expect(onUploaded).toHaveBeenCalledTimes(2);
    expect(screen.getByText("2개 파일 업로드 완료")).toBeInTheDocument();
  });

  it("rejects more than 20 files before calling the API", async () => {
    render(<UploadPage onUploaded={() => undefined} />);
    const files = Array.from({ length: 21 }, (_, index) => new File(["pdf"], `doc-${index}.pdf`, { type: "application/pdf" }));

    fireEvent.drop(screen.getByTestId("msds-dropzone"), {
      dataTransfer: { files }
    });

    expect(api.uploadBatch).not.toHaveBeenCalled();
    expect(await screen.findByText("한 번에 최대 20개까지만 업로드할 수 있습니다. 20개씩 나눠 올려주세요.")).toBeInTheDocument();
  });
});
