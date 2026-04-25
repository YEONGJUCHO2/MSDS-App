import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
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
            reviewStatus: "needs_review"
          }
        ]}
      />
    );

    expect(screen.getByText("67-64-1")).toBeInTheDocument();
    expect(screen.getByText("SECTION 3 / row 1")).toBeInTheDocument();
    expect(screen.getByText("검수필요")).toBeInTheDocument();
  });
});
