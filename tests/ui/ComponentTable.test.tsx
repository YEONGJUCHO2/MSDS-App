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

  it("separates official lookup-only rows from exportable regulatory hits", () => {
    render(
      <ComponentTable
        rows={[
          {
            rowId: "row-1",
            rowIndex: 0,
            rawRowText: "철 7439-89-6 65~75",
            casNoCandidate: "7439-89-6",
            chemicalNameCandidate: "철 Iron",
            contentMinCandidate: "65",
            contentMaxCandidate: "75",
            contentSingleCandidate: "",
            contentText: "65~75",
            confidence: 0.92,
            evidenceLocation: "SECTION 3 / row 1",
            reviewStatus: "needs_review",
            regulatoryMatches: [
              {
                matchId: "match-1",
                rowId: "row-1",
                documentId: "doc-1",
                casNo: "7439-89-6",
                category: "chemicalInfoLookup",
                status: "공식 API 조회됨",
                sourceType: "official_api",
                sourceName: "한국환경공단 화학물질 정보 조회 서비스",
                sourceUrl: "https://example.test",
                evidenceText: "Iron / KE-21059",
                checkedAt: "2026-04-25T00:00:00.000Z"
              }
            ]
          }
        ]}
      />
    );

    expect(screen.getByText("사내 입력 반영 0건")).toBeInTheDocument();
    expect(screen.getByText("공식 정보 조회만 된 항목은 사내 입력 컬럼에 표시하지 않습니다.")).toBeInTheDocument();
    expect(screen.queryByRole("cell", { name: "Y" })).not.toBeInTheDocument();
  });

  it("allows users to add, edit, recheck, and remove component rows from the export table", () => {
    const onAdd = vi.fn();
    const onUpdate = vi.fn();
    const onRemove = vi.fn();
    const onRecheck = vi.fn();

    render(
      <ComponentTable
        onAdd={onAdd}
        onRemove={onRemove}
        onRecheck={onRecheck}
        onUpdate={onUpdate}
        rows={[
          {
            rowId: "row-1",
            rowIndex: 0,
            rawRowText: "철 7439-89-6 65~75",
            casNoCandidate: "7439-89-6",
            chemicalNameCandidate: "철 Iron",
            contentMinCandidate: "65",
            contentMaxCandidate: "75",
            contentSingleCandidate: "",
            contentText: "65~75",
            confidence: 0.92,
            evidenceLocation: "SECTION 3 / row 1",
            reviewStatus: "needs_review",
            regulatoryMatches: []
          }
        ]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "수정" }));
    fireEvent.change(screen.getByLabelText("화학물질명"), { target: { value: "Iron powder" } });
    fireEvent.click(screen.getByLabelText("저장 후 API 재조회"));
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    expect(onUpdate).toHaveBeenCalledWith("row-1", {
      casNoCandidate: "7439-89-6",
      chemicalNameCandidate: "Iron powder",
      contentMinCandidate: "65",
      contentMaxCandidate: "75",
      contentSingleCandidate: ""
    }, true);

    fireEvent.click(screen.getByRole("button", { name: "재조회" }));
    expect(onRecheck).toHaveBeenCalledWith("row-1");

    fireEvent.click(screen.getByRole("button", { name: "추가" }));
    fireEvent.change(screen.getByLabelText("CAS No."), { target: { value: "96-29-7" } });
    fireEvent.change(screen.getByLabelText("화학물질명"), { target: { value: "Methylethylketoxime" } });
    fireEvent.change(screen.getByLabelText("MIN"), { target: { value: "0.1" } });
    fireEvent.change(screen.getByLabelText("MAX"), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "추가 저장" }));

    expect(onAdd).toHaveBeenCalledWith({
      casNoCandidate: "96-29-7",
      chemicalNameCandidate: "Methylethylketoxime",
      contentMinCandidate: "0.1",
      contentMaxCandidate: "1",
      contentSingleCandidate: ""
    }, false);

    fireEvent.click(screen.getByRole("button", { name: "제거" }));
    expect(onRemove).toHaveBeenCalledWith("row-1");
  });
});
