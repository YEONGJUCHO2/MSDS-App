import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ComponentTable } from "../../src/components/ComponentTable";

describe("ComponentTable", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows and copies the internal chemical table regulatory columns", () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    render(
      <ComponentTable
        rows={[
          {
            rowId: "row-1",
            rowIndex: 0,
            rawRowText: "산화알루미늄 1344-28-1 1~5",
            casNoCandidate: "1344-28-1",
            chemicalNameCandidate: "산화알루미늄",
            contentMinCandidate: "1",
            contentMaxCandidate: "5",
            contentSingleCandidate: "",
            contentText: "1~5",
            confidence: 0.92,
            evidenceLocation: "SECTION 3 / row 1",
            reviewStatus: "approved",
            regulatoryMatches: [
              {
                matchId: "match-1",
                rowId: "row-1",
                documentId: "doc-1",
                casNo: "1344-28-1",
                category: "workEnvironmentMeasurement",
                status: "해당 후보",
                sourceType: "internal_seed",
                sourceName: "내부 기준표",
                sourceUrl: "internal://seed",
                evidenceText: "산화알루미늄 6개월",
                checkedAt: "2026-04-25T00:00:00.000Z"
              }
            ]
          }
        ]}
      />
    );

    expect(screen.getByRole("columnheader", { name: "작업환경측정 대상물질" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "특수건강검진대상물질" })).toBeInTheDocument();
    expect(screen.queryByRole("cell", { name: "6개월" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("cell", { name: "Y" })).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "전체 복사" }));

    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("CAS No.\t화학물질\tMIN\tMAX\t단일\t특별관리물질"));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("1344-28-1\t산화알루미늄\t1\t5\t"));
  });
});
