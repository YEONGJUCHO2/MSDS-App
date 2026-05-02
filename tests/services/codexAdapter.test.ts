import { describe, expect, it } from "vitest";
import { createCodexAdapter, mergeBasicInfoWithCodex, parseJsonObject } from "../../server/services/codexAdapter";
import type { BasicInfoField } from "../../shared/types";

describe("Codex adapter", () => {
  it("refuses to call Codex CLI until local AI execution is explicitly enabled", async () => {
    const adapter = createCodexAdapter({ enabled: false });
    await expect(adapter.extractCandidates({ text: "제품명 A세척제", rows: [] })).resolves.toMatchObject({
      status: "disabled",
      reviewStatus: "needs_review"
    });
  });

  it("parses the final Codex message even when wrapped in markdown", () => {
    expect(parseJsonObject("```json\n{\"productName\":\"CS-200\",\"components\":[]}\n```")).toEqual({
      productName: "CS-200",
      components: []
    });
  });

  it("uses injected runner output to enrich basic info fields", async () => {
    const fields: BasicInfoField[] = [
      { key: "supplier", label: "공급사", value: "", source: "manual_required" },
      { key: "productName", label: "제품명", value: "룰 후보", source: "msds_text" }
    ];
    const adapter = createCodexAdapter({
      enabled: true,
      runner: async () => JSON.stringify({
        supplier: "조선선재㈜",
        productName: "CS-200",
        components: []
      })
    });

    await expect(adapter.enrichBasicInfo({ text: "생산 및 공급 회사명 : 조선선재㈜", localFields: fields })).resolves.toEqual([
      { key: "supplier", label: "공급사", value: "조선선재㈜", source: "codex_cli" },
      { key: "productName", label: "제품명", value: "CS-200", source: "codex_cli" }
    ]);
  });

  it("keeps user-saved basic info over Codex candidates", () => {
    const fields: BasicInfoField[] = [
      { key: "supplier", label: "공급사", value: "사용자 수정값", source: "user_saved" }
    ];

    expect(mergeBasicInfoWithCodex(fields, {
      supplier: "AI 후보",
      manufacturer: "",
      phone: "",
      email: "",
      productName: "",
      use: "",
      msdsNumber: "",
      revisionDate: "",
      revisionVersion: "",
      components: []
    })).toEqual(fields);
  });

  it("passes the configured model and high reasoning effort to Codex CLI", async () => {
    const calls: string[][] = [];
    const adapter = createCodexAdapter({
      enabled: true,
      command: "codex",
      model: "gpt-5.5",
      reasoningEffort: "high",
      spawnRunner: async (_command, args) => {
        calls.push(args);
        return JSON.stringify({
          productName: "",
          supplier: "",
          manufacturer: "",
          phone: "",
          email: "",
          use: "",
          msdsNumber: "",
          revisionDate: "",
          revisionVersion: "",
          components: []
        });
      }
    });

    await adapter.extractCandidates({ text: "3. 구성성분", rows: [] });

    expect(calls[0]).toContain("--model");
    expect(calls[0]).toContain("gpt-5.5");
    expect(calls[0]).toEqual(expect.arrayContaining(["--config", "model_reasoning_effort=\"high\""]));
  });
});
