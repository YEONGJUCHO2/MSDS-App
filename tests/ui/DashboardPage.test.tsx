import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DashboardPage } from "../../src/pages/DashboardPage";
import type { DocumentSummary, ReviewQueueItem } from "../../shared/types";

describe("DashboardPage", () => {
  it("frames pending work as human attention needed for chemical management", () => {
    const onNavigate = vi.fn();
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

    render(<DashboardPage documents={documents} queueItems={queueItems} onNavigate={onNavigate} />);

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
    expect(onNavigate).toHaveBeenCalledWith("queues");
    fireEvent.click(screen.getByRole("button", { name: "개정 필요0" }));
    expect(onNavigate).toHaveBeenCalledWith("revisions");
  });
});
