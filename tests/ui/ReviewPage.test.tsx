import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReviewPage } from "../../src/pages/ReviewPage";
import { api } from "../../src/api/client";
import type { DocumentSummary } from "../../shared/types";

vi.mock("../../src/api/client", () => ({
  api: {
    components: vi.fn(),
    documentFileUrl: (documentId: string) => `/api/documents/${documentId}/file`,
    documentBasicInfo: vi.fn(),
    recheckDocuments: vi.fn()
  }
}));

describe("ReviewPage", () => {
  it("shows component rows even while basic info enrichment is still pending", async () => {
    const documents: DocumentSummary[] = [{
      documentId: "doc-1",
      fileName: "sample.pdf",
      status: "needs_review",
      uploadedAt: "2026-04-26T00:00:00.000Z",
      componentCount: 1,
      queueCount: 0
    }];
    vi.mocked(api.components).mockResolvedValue({
      rows: [{
        rowId: "row-1",
        rowIndex: 0,
        rawRowText: "Methylethylketoxime 96-29-7 0.1~1",
        casNoCandidate: "96-29-7",
        chemicalNameCandidate: "Methylethylketoxime",
        contentMinCandidate: "0.1",
        contentMaxCandidate: "1",
        contentSingleCandidate: "",
        contentText: "0.1~1",
        confidence: 0.9,
        evidenceLocation: "SECTION 3 / row 1",
        reviewStatus: "needs_review",
        regulatoryMatches: []
      }]
    });
    vi.mocked(api.documentBasicInfo).mockReturnValue(new Promise(() => undefined));

    render(<ReviewPage documents={documents} onDeleteDocument={vi.fn()} />);

    await waitFor(() => expect(screen.getAllByRole("cell", { name: "96-29-7" }).length).toBeGreaterThan(0));
    expect(screen.getAllByRole("cell", { name: "Methylethylketoxime" }).length).toBeGreaterThan(0);
  });

  it("shows a loading state instead of an empty basic info panel while basic info is pending", async () => {
    const documents: DocumentSummary[] = [{
      documentId: "doc-1",
      fileName: "sample.pdf",
      status: "needs_review",
      uploadedAt: "2026-04-26T00:00:00.000Z",
      componentCount: 0,
      queueCount: 0
    }];
    vi.mocked(api.components).mockResolvedValue({ rows: [] });
    vi.mocked(api.documentBasicInfo).mockReturnValue(new Promise(() => undefined));

    render(<ReviewPage documents={documents} onDeleteDocument={vi.fn()} />);

    expect(await screen.findByText("물품 기본 정보를 불러오는 중입니다.")).toBeInTheDocument();
  });

  it("selects paginated MSDS documents for batch lookup from the review list", async () => {
    const documents: DocumentSummary[] = Array.from({ length: 6 }, (_, index) => ({
      documentId: `doc-${index + 1}`,
      fileName: `review-${index + 1}.pdf`,
      status: "needs_review",
      uploadedAt: `2026-04-${20 + index}T00:00:00.000Z`,
      componentCount: index + 1,
      queueCount: 0
    }));
    vi.mocked(api.components).mockResolvedValue({ rows: [] });
    vi.mocked(api.documentBasicInfo).mockResolvedValue({ documentId: "doc-1", fields: [] });
    vi.mocked(api.recheckDocuments).mockResolvedValue({ documentCount: 5, rowCount: 5, results: [] });

    render(<ReviewPage documents={documents} onDeleteDocument={vi.fn()} />);

    expect(await screen.findByText("review-1.pdf")).toBeInTheDocument();
    expect(screen.queryByText("review-6.pdf")).not.toBeInTheDocument();
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "선택 조회/재조회" })).toBeDisabled();

    fireEvent.click(screen.getByLabelText("현재 페이지 MSDS 전체 선택"));
    fireEvent.click(screen.getByRole("button", { name: "선택 조회/재조회" }));

    await waitFor(() => expect(api.recheckDocuments).toHaveBeenCalledWith(["doc-1", "doc-2", "doc-3", "doc-4", "doc-5"]));
    expect(await screen.findByText("5개 MSDS · 5개 성분 조회/재조회 완료")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "다음 페이지" }));
    expect(screen.getByText("review-6.pdf")).toBeInTheDocument();
    expect(screen.queryByText("review-1.pdf")).not.toBeInTheDocument();
  });

  it("renders the MSDS list as a searchable five-slot table above basic information", async () => {
    const onDeleteDocument = vi.fn();
    const documents: DocumentSummary[] = [
      {
        documentId: "doc-1",
        fileName: "abcdefghijklmnopqrstuvwxyz.pdf",
        status: "needs_review",
        uploadedAt: "2026-04-29T00:00:00.000Z",
        componentCount: 4,
        queueCount: 1
      },
      {
        documentId: "doc-2",
        fileName: "registered.pdf",
        status: "needs_review",
        uploadedAt: "2026-04-28T00:00:00.000Z",
        componentCount: 3,
        queueCount: 0
      },
      {
        documentId: "doc-3",
        fileName: "hidden.pdf",
        status: "needs_review",
        uploadedAt: "2026-04-27T00:00:00.000Z",
        componentCount: 0,
        queueCount: 0
      }
    ];
    vi.mocked(api.components).mockResolvedValue({ rows: [] });
    vi.mocked(api.documentBasicInfo).mockResolvedValue({ documentId: "doc-1", fields: [] });

    const { container } = render(<ReviewPage documents={documents} onDeleteDocument={onDeleteDocument} />);

    expect(await screen.findByRole("columnheader", { name: "번호" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "파일명" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "등록일자" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "상태" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("파일명, 상태, 날짜로 MSDS 검색")).toBeInTheDocument();
    expect(screen.getByText("abcdefghijklmnopqrst...")).toBeInTheDocument();

    const listPanel = container.querySelector(".msds-list-panel");
    const basicInfoPanel = container.querySelector(".basic-info-panel");
    expect(listPanel?.compareDocumentPosition(basicInfoPanel as Node)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);

    fireEvent.change(screen.getByPlaceholderText("파일명, 상태, 날짜로 MSDS 검색"), { target: { value: "registered" } });
    expect(screen.getByText("registered.pdf")).toBeInTheDocument();
    expect(screen.queryByText("abcdefghijklmnopqrst...")).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("registered.pdf 선택"));
    fireEvent.click(screen.getByRole("button", { name: "선택항목 삭제" }));
    expect(onDeleteDocument).toHaveBeenCalledWith("doc-2");
  });

  it("selects an MSDS when the file name is clicked and exposes attachment downloads", async () => {
    const documents: DocumentSummary[] = [
      {
        documentId: "doc-1",
        fileName: "first.pdf",
        status: "needs_review",
        uploadedAt: "2026-04-29T00:00:00.000Z",
        componentCount: 4,
        queueCount: 1
      },
      {
        documentId: "doc-2",
        fileName: "second.pdf",
        status: "needs_review",
        uploadedAt: "2026-04-28T00:00:00.000Z",
        componentCount: 3,
        queueCount: 0
      }
    ];
    vi.mocked(api.components).mockResolvedValue({ rows: [] });
    vi.mocked(api.documentBasicInfo).mockResolvedValue({ documentId: "doc-1", fields: [] });

    render(<ReviewPage documents={documents} onDeleteDocument={vi.fn()} />);

    await screen.findByText("first.pdf");
    fireEvent.click(screen.getByRole("button", { name: "second.pdf MSDS 선택" }));

    await waitFor(() => expect(api.components).toHaveBeenLastCalledWith("doc-2"));
    expect(screen.getByRole("columnheader", { name: "첨부파일" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "second.pdf 첨부파일 열기" })).toHaveAttribute("href", "/api/documents/doc-2/file");
    expect(screen.getByRole("button", { name: "second.pdf 삭제" })).toHaveClass("icon-danger-action");
  });
});
