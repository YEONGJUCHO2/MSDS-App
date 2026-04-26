import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReviewPage } from "../../src/pages/ReviewPage";
import { api } from "../../src/api/client";
import type { DocumentSummary } from "../../shared/types";

vi.mock("../../src/api/client", () => ({
  api: {
    components: vi.fn(),
    documentBasicInfo: vi.fn()
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
});
