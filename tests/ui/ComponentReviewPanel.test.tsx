import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ComponentReviewPanel } from "../../src/components/ComponentReviewPanel";

describe("ComponentReviewPanel", () => {
  it("groups extracted component data with evidence and status", () => {
    render(
      <ComponentReviewPanel
        rows={[
          {
            rowId: "row-1",
            casNoCandidate: "67-64-1",
            chemicalNameCandidate: "Acetone",
            contentText: "30~60%",
            evidenceLocation: "SECTION 3 / row 1",
            reviewStatus: "needs_review",
            aiReviewStatus: "ai_candidate",
            aiReviewNote: "CAS No., 물질명, 함유량이 같은 행에서 추출되었습니다.",
            regulatoryMatchStatus: "internal_seed_matched",
            regulatoryMatches: [
              {
                matchId: "match-1",
                rowId: "row-1",
                documentId: "doc-1",
                casNo: "67-64-1",
                category: "specialHealthExam",
                status: "해당 후보",
                sourceType: "internal_seed",
                sourceName: "내부 기준표",
                sourceUrl: "internal://seed",
                evidenceText: "아세톤 12개월",
                checkedAt: "2026-04-25T00:00:00.000Z"
              }
            ]
          }
        ]}
      />
    );

    expect(screen.getByText("67-64-1")).toBeInTheDocument();
    expect(screen.getByText("SECTION 3 / row 1")).toBeInTheDocument();
    expect(screen.getByText("검수필요")).toBeInTheDocument();
    expect(screen.getByText("AI 후보")).toBeInTheDocument();
    expect(screen.getByText("내부 기준 매칭")).toBeInTheDocument();
  });

  it("lets users manually recheck official data for a component row", () => {
    const onRecheck = vi.fn();
    render(
      <ComponentReviewPanel
        onRecheck={onRecheck}
        rows={[
          {
            rowId: "row-1",
            casNoCandidate: "67-64-1",
            chemicalNameCandidate: "Acetone",
            contentText: "30~60%",
            evidenceLocation: "SECTION 3 / row 1",
            reviewStatus: "needs_review",
            aiReviewStatus: "ai_candidate",
            aiReviewNote: "CAS No., 물질명, 함유량이 같은 행에서 추출되었습니다.",
            regulatoryMatchStatus: "api_key_required",
            regulatoryMatches: []
          }
        ]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "공식조회" }));

    expect(onRecheck).toHaveBeenCalledWith("row-1");
  });

  it("lets users approve or exclude a component row", () => {
    const onReviewStatusChange = vi.fn();
    render(
      <ComponentReviewPanel
        onReviewStatusChange={onReviewStatusChange}
        rows={[
          {
            rowId: "row-1",
            casNoCandidate: "67-64-1",
            chemicalNameCandidate: "Acetone",
            contentText: "30~60%",
            evidenceLocation: "SECTION 3 / row 1",
            reviewStatus: "needs_review",
            aiReviewStatus: "ai_candidate",
            aiReviewNote: "CAS No., 물질명, 함유량이 같은 행에서 추출되었습니다.",
            regulatoryMatchStatus: "api_key_required",
            regulatoryMatches: []
          }
        ]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "확인" }));
    fireEvent.click(screen.getByRole("button", { name: "제외" }));

    expect(onReviewStatusChange).toHaveBeenNthCalledWith(1, "row-1", "approved");
    expect(onReviewStatusChange).toHaveBeenNthCalledWith(2, "row-1", "excluded");
  });
});
