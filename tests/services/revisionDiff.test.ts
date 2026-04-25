import { describe, expect, it } from "vitest";
import { diffComponentRevisions } from "../../server/services/revisionDiff";

describe("revision diff", () => {
  it("reports CAS additions, removals, and concentration changes", () => {
    const before = [
      { casNo: "67-64-1", chemicalName: "Acetone", concentrationText: "10~20%" },
      { casNo: "108-88-3", chemicalName: "Toluene", concentrationText: "1%" }
    ];
    const after = [
      { casNo: "67-64-1", chemicalName: "Acetone", concentrationText: "30~60%" },
      { casNo: "64-17-5", chemicalName: "Ethanol", concentrationText: "5%" }
    ];

    expect(diffComponentRevisions(before, after)).toEqual([
      { type: "concentration_changed", casNo: "67-64-1", before: "10~20%", after: "30~60%" },
      { type: "removed", casNo: "108-88-3", before: "1%", after: "" },
      { type: "added", casNo: "64-17-5", before: "", after: "5%" }
    ]);
  });
});
