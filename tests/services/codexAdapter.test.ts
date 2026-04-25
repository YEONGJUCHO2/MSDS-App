import { describe, expect, it } from "vitest";
import { createCodexAdapter } from "../../server/services/codexAdapter";

describe("Codex adapter", () => {
  it("refuses to call Codex CLI until local AI execution is explicitly enabled", async () => {
    const adapter = createCodexAdapter({ enabled: false });
    await expect(adapter.extractCandidates({ text: "제품명 A세척제", rows: [] })).resolves.toMatchObject({
      status: "disabled",
      reviewStatus: "needs_review"
    });
  });
});
