import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../src/api/client";
import { UploadPage, UploadTaskFeedback } from "../../src/pages/UploadPage";

vi.mock("../../src/api/client", () => ({
  api: {
    upload: vi.fn(),
    uploadBatch: vi.fn()
  }
}));

describe("UploadPage", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.mocked(api.upload).mockReset();
    vi.mocked(api.uploadBatch).mockReset();
    vi.mocked(api.upload).mockResolvedValue({ documentId: "doc-1", status: "needs_review", message: "업로드 완료" });
    vi.mocked(api.uploadBatch).mockResolvedValue({
      results: [
        { success: true, fileName: "first.pdf", documentId: "doc-1", status: "needs_review", message: "업로드 완료" },
        { success: true, fileName: "second.pdf", documentId: "doc-2", status: "needs_review", message: "업로드 완료" }
      ]
    });
  });

  it("allows selecting more than one MSDS document at once", () => {
    render(<UploadPage onUploaded={() => undefined} />);

    expect(screen.getByTestId("msds-file-input")).toHaveAttribute("multiple");
    expect(screen.getByTestId("msds-file-input")).toHaveAttribute("accept", expect.stringContaining(".docx"));
    expect(screen.getByTestId("msds-file-input")).toHaveAttribute("accept", expect.stringContaining(".xlsx"));
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
    expect(screen.queryByText("2개 파일 업로드 완료")).not.toBeInTheDocument();
    expect(screen.queryByText("first.pdf")).not.toBeInTheDocument();
  });

  it("shows an active upload progress panel while a batch is pending", async () => {
    let resolveUpload: (value: Awaited<ReturnType<typeof api.uploadBatch>>) => void = () => undefined;
    vi.mocked(api.uploadBatch).mockReturnValue(new Promise((resolve) => {
      resolveUpload = resolve;
    }));
    render(<UploadPage onUploaded={() => undefined} />);
    const files = [
      new File(["first"], "first.pdf", { type: "application/pdf" }),
      new File(["second"], "second.pdf", { type: "application/pdf" })
    ];

    fireEvent.drop(screen.getByTestId("msds-dropzone"), {
      dataTransfer: { files }
    });

    expect(await screen.findByText("업로드 중 2/20")).toBeInTheDocument();
    expect(screen.getByLabelText("현재 업로드 단계")).toHaveTextContent("AI가 문서를 분석중입니다");
    expect(screen.getByRole("progressbar", { name: "MSDS 업로드 진행 중" })).toBeInTheDocument();
    expect(screen.getByText("first.pdf")).toBeInTheDocument();
    expect(screen.getByText("second.pdf")).toBeInTheDocument();
    expect(screen.getAllByText("대기 중")).toHaveLength(2);

    resolveUpload({
      results: [
        { success: true, fileName: "first.pdf", documentId: "doc-1", status: "needs_review", message: "업로드 완료" },
        { success: true, fileName: "second.pdf", documentId: "doc-2", status: "needs_review", message: "업로드 완료" }
      ]
    });

    await waitFor(() => expect(screen.queryByText("업로드 중 2/20")).not.toBeInTheDocument());
    expect(screen.queryByText("2개 파일 업로드 완료")).not.toBeInTheDocument();
    expect(screen.queryByText("first.pdf")).not.toBeInTheDocument();
  });

  it("cycles the active upload stage without pretending to know an exact percentage", async () => {
    vi.useFakeTimers();
    render(
      <UploadTaskFeedback
        task={{
          busy: true,
          message: "",
          pendingFiles: [new File(["first"], "first.pdf", { type: "application/pdf" })],
          uploadResults: []
        }}
      />
    );

    expect(screen.getByLabelText("현재 업로드 단계")).toHaveTextContent("AI가 문서를 분석중입니다");
    expect(screen.getByRole("progressbar", { name: "MSDS 업로드 진행 중" })).toHaveAttribute(
      "aria-valuetext",
      "AI가 문서를 분석중입니다"
    );
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(1600);
    });

    expect(screen.getByLabelText("현재 업로드 단계")).toHaveTextContent("API와 대조중입니다");
    expect(screen.getByRole("progressbar", { name: "MSDS 업로드 진행 중" })).toHaveAttribute(
      "aria-valuetext",
      "API와 대조중입니다"
    );
  });

  it("accepts modern Word and Excel MSDS files for upload", async () => {
    const onUploaded = vi.fn();
    vi.mocked(api.uploadBatch).mockResolvedValue({
      results: [
        { success: true, fileName: "word.docx", documentId: "doc-1", status: "needs_review", message: "업로드 완료" },
        { success: true, fileName: "sheet.xlsx", documentId: "doc-2", status: "needs_review", message: "업로드 완료" }
      ]
    });
    render(<UploadPage onUploaded={onUploaded} />);
    const files = [
      new File(["word"], "word.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }),
      new File(["sheet"], "sheet.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
    ];

    fireEvent.drop(screen.getByTestId("msds-dropzone"), {
      dataTransfer: { files }
    });

    await waitFor(() => expect(api.uploadBatch).toHaveBeenCalledWith(files));
    expect(onUploaded).toHaveBeenCalledTimes(2);
  });

  it("shows failed batch files separately from successful uploads", async () => {
    vi.mocked(api.uploadBatch).mockResolvedValue({
      results: [
        { success: true, fileName: "ok.pdf", documentId: "doc-ok", status: "needs_review", message: "업로드 완료" },
        { success: false, fileName: "bad.pdf", error: "PDF text extraction failed" }
      ]
    });
    const onUploaded = vi.fn();
    render(<UploadPage onUploaded={onUploaded} />);
    const files = [
      new File(["ok"], "ok.pdf", { type: "application/pdf" }),
      new File(["bad"], "bad.pdf", { type: "application/pdf" })
    ];

    fireEvent.drop(screen.getByTestId("msds-dropzone"), {
      dataTransfer: { files }
    });

    expect(await screen.findByText("1개 파일 업로드 완료, 1개 파일 실패")).toBeInTheDocument();
    expect(screen.getByText("ok.pdf")).toBeInTheDocument();
    expect(screen.getByText("bad.pdf: PDF text extraction failed")).toBeInTheDocument();
    expect(screen.queryByText("2개 파일 업로드 완료")).not.toBeInTheDocument();
    expect(onUploaded).toHaveBeenCalledTimes(1);
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
