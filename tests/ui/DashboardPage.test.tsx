import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DashboardPage } from "../../src/pages/DashboardPage";
import type { DocumentSummary, ReviewQueueItem } from "../../shared/types";

describe("DashboardPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("frames pending work as human attention needed for chemical management", () => {
    const onNavigate = vi.fn();
    const onDeleteDocument = vi.fn();
    const documents: DocumentSummary[] = [
      {
        documentId: "doc-1",
        fileName: "sample.pdf",
        status: "needs_review",
        uploadedAt: "2026-04-25T00:00:00.000Z",
        componentCount: 3,
        queueCount: 1
      },
      {
        documentId: "doc-2",
        fileName: "clean.pdf",
        status: "needs_review",
        uploadedAt: "2026-04-25T01:00:00.000Z",
        componentCount: 2,
        queueCount: 0
      }
    ];
    const queueItems: ReviewQueueItem[] = [
      {
        queueId: "queue-1",
        documentId: "doc-1",
        fieldType: "component",
        label: "CAS 확인 필요",
        candidateValue: "",
        evidence: "SECTION 3 / row 1",
        reviewStatus: "needs_review",
        createdAt: "2026-04-25T00:00:00.000Z"
      },
      {
        queueId: "queue-2",
        documentId: "doc-1",
        fieldType: "component",
        label: "검토 완료",
        candidateValue: "96-29-7",
        evidence: "SECTION 3 / row 2",
        reviewStatus: "approved",
        createdAt: "2026-04-25T00:00:00.000Z"
      }
    ];

    const onOpenDocument = vi.fn();
    render(<DashboardPage documents={documents} queueItems={queueItems} onDeleteDocument={onDeleteDocument} onNavigate={onNavigate} onOpenDocument={onOpenDocument} onRecheckDocuments={vi.fn()} />);

    expect(screen.getAllByText("검수 필요").length).toBeGreaterThan(0);
    expect(screen.queryByText("검수필요")).not.toBeInTheDocument();
    expect(screen.getByText("등록된 MSDS")).toBeInTheDocument();
    expect(screen.getByText("등록된 화학물질")).toBeInTheDocument();
    expect(screen.getByText("개정 필요")).toBeInTheDocument();
    expect(screen.getByText("2026-04-25 · 화학물질 3 · 검수 1")).toBeInTheDocument();
    expect(screen.getByText("2026-04-25 · 화학물질 2 · 검수 0")).toBeInTheDocument();
    expect(screen.getAllByText("검수 필요").length).toBeGreaterThan(0);
    expect(screen.getAllByText("등록됨").length).toBeGreaterThan(0);
    expect(screen.queryByText("needs_review")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "검수 필요1" }));
    expect(onNavigate).toHaveBeenCalledWith("review");
    fireEvent.click(screen.getByRole("button", { name: "개정 필요0" }));
    expect(onNavigate).toHaveBeenCalledWith("revisions");

    fireEvent.click(screen.getByRole("button", { name: "sample.pdf 삭제" }));
    expect(onDeleteDocument).toHaveBeenCalledWith("doc-1");
  });

  it("filters uploaded MSDS documents immediately and opens a selected document", () => {
    const onNavigate = vi.fn();
    const onDeleteDocument = vi.fn();
    const onOpenDocument = vi.fn();
    const documents: DocumentSummary[] = [
      {
        documentId: "doc-1",
        fileName: "CA-13R(부정형) 내화물.pdf",
        status: "needs_review",
        uploadedAt: "2026-04-29T00:00:00.000Z",
        componentCount: 4,
        queueCount: 1
      },
      {
        documentId: "doc-2",
        fileName: "msds_(화성).pdf",
        status: "needs_review",
        uploadedAt: "2026-04-28T00:00:00.000Z",
        componentCount: 3,
        queueCount: 0
      }
    ];

    render(<DashboardPage documents={documents} queueItems={[]} onDeleteDocument={onDeleteDocument} onNavigate={onNavigate} onOpenDocument={onOpenDocument} onRecheckDocuments={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText("파일명, 상태, 날짜로 MSDS 검색"), { target: { value: "CA-13R" } });

    expect(screen.getByText("CA-13R(부정형) 내화물.pdf")).toBeInTheDocument();
    expect(screen.queryByText("msds_(화성).pdf")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "CA-13R(부정형) 내화물.pdf MSDS에서 보기" }));
    expect(onOpenDocument).toHaveBeenCalledWith("doc-1");
  });

  it("selects paginated uploaded MSDS documents for batch lookup", () => {
    const onRecheckDocuments = vi.fn();
    const documents = Array.from({ length: 6 }, (_, index) => ({
      documentId: `doc-${index + 1}`,
      fileName: `sample-${index + 1}.pdf`,
      status: "needs_review" as const,
      uploadedAt: `2026-04-${20 + index}T00:00:00.000Z`,
      componentCount: index + 1,
      queueCount: 0
    }));

    render(
      <DashboardPage
        documents={documents}
        queueItems={[]}
        onDeleteDocument={vi.fn()}
        onNavigate={vi.fn()}
        onOpenDocument={vi.fn()}
        onRecheckDocuments={onRecheckDocuments}
      />
    );

    expect(screen.getByText("sample-1.pdf")).toBeInTheDocument();
    expect(screen.queryByText("sample-6.pdf")).not.toBeInTheDocument();
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "선택 조회/재조회" })).toBeDisabled();

    fireEvent.click(screen.getByLabelText("현재 페이지 MSDS 전체 선택"));
    fireEvent.click(screen.getByRole("button", { name: "선택 조회/재조회" }));

    expect(onRecheckDocuments).toHaveBeenCalledWith(["doc-1", "doc-2", "doc-3", "doc-4", "doc-5"]);

    fireEvent.click(screen.getByRole("button", { name: "다음 페이지" }));
    expect(screen.getByText("sample-6.pdf")).toBeInTheDocument();
    expect(screen.queryByText("sample-1.pdf")).not.toBeInTheDocument();
  });

  it("renders MSDS documents in a five-slot table and deletes selected documents", () => {
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
      }
    ];

    render(
      <DashboardPage
        documents={documents}
        queueItems={[]}
        onDeleteDocument={onDeleteDocument}
        onNavigate={vi.fn()}
        onOpenDocument={vi.fn()}
        onRecheckDocuments={vi.fn()}
      />
    );

    expect(screen.getByRole("columnheader", { name: "번호" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "파일명" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "등록일자" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "상태" })).toBeInTheDocument();
    expect(screen.getByText("abcdefghijklmnopqrst...")).toBeInTheDocument();
    expect(screen.queryByText("abcdefghijklmnopqrstuvwxyz.pdf")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "선택항목 삭제" })).toBeDisabled();

    fireEvent.click(screen.getByLabelText("abcdefghijklmnopqrstuvwxyz.pdf 선택"));
    fireEvent.click(screen.getByLabelText("registered.pdf 선택"));
    fireEvent.click(screen.getByRole("button", { name: "선택항목 삭제" }));

    expect(onDeleteDocument).toHaveBeenNthCalledWith(1, "doc-1");
    expect(onDeleteDocument).toHaveBeenNthCalledWith(2, "doc-2");
  });

  it("offers attachment downloads for selected and individual MSDS documents", () => {
    const documents: DocumentSummary[] = [
      {
        documentId: "doc-1",
        fileName: "first.pdf",
        status: "needs_review",
        uploadedAt: "2026-04-29T00:00:00.000Z",
        componentCount: 4,
        queueCount: 1
      }
    ];

    render(
      <DashboardPage
        documents={documents}
        queueItems={[]}
        onDeleteDocument={vi.fn()}
        onNavigate={vi.fn()}
        onOpenDocument={vi.fn()}
        onRecheckDocuments={vi.fn()}
      />
    );

    expect(screen.getByRole("columnheader", { name: "첨부파일" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "first.pdf 첨부파일 다운로드" })).toHaveAttribute("href", "/api/documents/doc-1/file");
    expect(screen.getByRole("button", { name: "선택 첨부 다운로드" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "first.pdf 삭제" })).toHaveClass("icon-danger-action");

    const openSpy = vi.spyOn(window, "open").mockReturnValue(null);
    fireEvent.click(screen.getByLabelText("first.pdf 선택"));

    expect(screen.getByRole("button", { name: "선택 첨부 다운로드" })).not.toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "선택 첨부 다운로드" }));

    expect(openSpy).toHaveBeenCalledWith("/api/documents/doc-1/file", "_blank", "noopener,noreferrer");
  });
});
