import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ComponentReviewPanel } from "../../src/components/ComponentReviewPanel";

describe("ComponentReviewPanel", () => {
  it("shows extracted component candidates in a compact review table", () => {
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

    expect(screen.getByRole("columnheader", { name: "화학물질" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "CAS No." })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Acetone" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "67-64-1" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "확인" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "제외" })).not.toBeInTheDocument();
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

  it("shows the latest official lookup message for a row", () => {
    render(
      <ComponentReviewPanel
        recheckMessages={{ "row-1": "공식 API URL/키가 설정되지 않아 외부 조회는 실행되지 않았습니다." }}
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

    expect(screen.getByText("공식 API URL/키가 설정되지 않아 외부 조회는 실행되지 않았습니다.")).toBeInTheDocument();
  });

  it("does not render extracted concentration values as chemical names", () => {
    render(
      <ComponentReviewPanel
        rows={[
          {
            rowId: "row-1",
            casNoCandidate: "70131-67-8",
            chemicalNameCandidate: "",
            contentText: "30~40",
            evidenceLocation: "SECTION 3 / row 1",
            reviewStatus: "needs_review",
            aiReviewStatus: "ai_needs_attention",
            aiReviewNote: "성분명이 같은 행에서 확인되지 않았습니다.",
            regulatoryMatchStatus: "not_checked",
            regulatoryMatches: []
          }
        ]}
      />
    );

    expect(screen.getByRole("cell", { name: "성분명 확인필요" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "30~40" })).toBeInTheDocument();
  });
});
