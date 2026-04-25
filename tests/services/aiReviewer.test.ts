import { describe, expect, it } from "vitest";
import { reviewComponentRows } from "../../server/services/aiReviewer";

describe("AI reviewer", () => {
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
});
