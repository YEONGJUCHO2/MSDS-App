import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../src/api/client";
import { UploadPage } from "../../src/pages/UploadPage";

vi.mock("../../src/api/client", () => ({
  api: {
    upload: vi.fn()
  }
}));

describe("UploadPage", () => {
  beforeEach(() => {
    vi.mocked(api.upload).mockReset();
    vi.mocked(api.upload).mockResolvedValue({ documentId: "doc-1", status: "needs_review", message: "업로드 완료" });
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

    await waitFor(() => expect(api.upload).toHaveBeenCalledTimes(2));
    expect(api.upload).toHaveBeenNthCalledWith(1, files[0]);
    expect(api.upload).toHaveBeenNthCalledWith(2, files[1]);
    expect(onUploaded).toHaveBeenCalledTimes(2);
    expect(screen.getByText("2개 파일 업로드 완료")).toBeInTheDocument();
  });
});
