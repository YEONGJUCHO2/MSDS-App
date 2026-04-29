import { afterEach, describe, expect, it, vi } from "vitest";
import { reviewComponentRows } from "../../server/services/aiReviewer";

describe("AI reviewer", () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock("../../server/services/aiProvider");
  });

  it("marks complete extracted rows as AI-reviewed candidates, not human approved records", () => {
    const result = reviewComponentRows([
      {
        rowIndex: 0,
        rawRowText: "Acetone 67-64-1 30~60%",
        casNoCandidate: "67-64-1",
        chemicalNameCandidate: "Acetone",
        contentMinCandidate: "30",
        contentMaxCandidate: "60",
        contentSingleCandidate: "",
        contentText: "30~60",
        confidence: 0.82,
        evidenceLocation: "SECTION 3 / row 1",
        reviewStatus: "needs_review"
      }
    ]);

    expect(result[0]).toMatchObject({
      aiReviewStatus: "ai_candidate",
      aiReviewNote: "CAS No., 물질명, 함유량이 같은 행에서 추출되었습니다."
    });
  });

  it("flags rows that are missing key fields", () => {
    const result = reviewComponentRows([
      {
        rowIndex: 0,
        rawRowText: "Trade secret 30~40%",
        casNoCandidate: "",
        chemicalNameCandidate: "Trade secret",
        contentMinCandidate: "30",
        contentMaxCandidate: "40",
        contentSingleCandidate: "",
        contentText: "30~40",
        confidence: 0.55,
        evidenceLocation: "SECTION 3 / row 1",
        reviewStatus: "needs_review"
      }
    ]);

    expect(result[0]).toMatchObject({
      aiReviewStatus: "ai_needs_attention",
      aiReviewNote: "CAS No. 누락"
    });
  });

  it("uses completed AI structured components as the primary extraction result", async () => {
    vi.resetModules();
    vi.doMock("../../server/services/aiProvider", () => ({
      resolveAiProvider: () => ({ provider: "codex", configured: true }),
      getAiProviderLabel: () => "Codex CLI",
      createConfiguredAiAdapter: () => ({
        extractCandidates: vi.fn().mockResolvedValue({
          status: "completed",
          reviewStatus: "needs_review",
          message: "Codex CLI 후보값 구조화를 완료했습니다.",
          candidate: {
            productName: "",
            supplier: "",
            manufacturer: "",
            phone: "",
            email: "",
            use: "",
            msdsNumber: "",
            revisionDate: "",
            revisionVersion: "",
            components: [
              {
                casNo: "1333-74-0",
                chemicalName: "수소",
                contentMin: "",
                contentMax: "",
                contentSingle: "99.9",
                evidence: "SECTION 3: 수소 1333-74-0 99.9",
                reviewStatus: "needs_review"
              }
            ]
          }
        })
      })
    }));
    const { reviewComponentRowsWithOptionalCodex } = await import("../../server/services/aiReviewer");

    const result = await reviewComponentRowsWithOptionalCodex("MSDS 원문", [
      {
        rowIndex: 0,
        rawRowText: "오르토수소; 파라하이드로젠 1333-74-0 99.9",
        casNoCandidate: "1333-74-0",
        chemicalNameCandidate: "오르토수소; 파라하이드로젠",
        contentMinCandidate: "",
        contentMaxCandidate: "",
        contentSingleCandidate: "99.9",
        contentText: "99.9",
        confidence: 0.55,
        evidenceLocation: "SECTION 3 / row 1",
        reviewStatus: "needs_review"
      }
    ]);

    expect(result).toMatchObject([
      {
        rowIndex: 0,
        casNoCandidate: "1333-74-0",
        chemicalNameCandidate: "수소",
        contentSingleCandidate: "99.9",
        contentText: "99.9",
        aiReviewStatus: "ai_candidate"
      }
    ]);
    expect(result[0].aiReviewNote).toContain("Codex CLI 구조화 결과를 사내 입력 후보로 사용했습니다.");
  });
});
