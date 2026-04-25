import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { QueuesPage } from "../../src/pages/QueuesPage";
import type { ReviewQueueItem } from "../../shared/types";

describe("QueuesPage", () => {
  it("shows only pending review items by default", () => {
    const items: ReviewQueueItem[] = [
      {
        queueId: "queue-1",
        documentId: "doc-1",
        entityId: "row-1",
        fieldType: "component",
        label: "Acetone / 67-64-1",
        candidateValue: "30~60",
        evidence: "SECTION 3 / row 1",
        reviewStatus: "needs_review",
        createdAt: "2026-04-25T00:00:00.000Z"
      },
      {
        queueId: "queue-2",
        documentId: "doc-1",
        entityId: "row-2",
        fieldType: "component",
        label: "Water / 7732-18-5",
        candidateValue: "40~70",
        evidence: "SECTION 3 / row 2",
        reviewStatus: "approved",
        createdAt: "2026-04-25T00:00:00.000Z"
      }
    ];

    render(<QueuesPage items={items} />);

    expect(screen.getByText("1건 대기 · 전체 2건")).toBeInTheDocument();
    expect(screen.getByText("Acetone / 67-64-1")).toBeInTheDocument();
    expect(screen.queryByText("Water / 7732-18-5")).not.toBeInTheDocument();
  });
});
