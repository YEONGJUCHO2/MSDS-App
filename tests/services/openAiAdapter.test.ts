import { describe, expect, it, vi } from "vitest";
import { createOpenAiAdapter, mergeBasicInfoWithOpenAi } from "../../server/services/openAiAdapter";
import type { BasicInfoField } from "../../shared/types";

describe("OpenAI adapter", () => {
  it("uses gpt-5-mini as the default model for MSDS structuring", async () => {
    const fetcher = vi.fn(async (_input: Parameters<typeof fetch>[0], _init?: Parameters<typeof fetch>[1]) => new Response(JSON.stringify({
      output_text: JSON.stringify({
        productName: "MY-M-11",
        supplier: "포스코퓨처엠",
        components: []
      })
    })));
    const adapter = createOpenAiAdapter({ enabled: true, apiKey: "test-key", fetcher });

    await adapter.extractCandidates({ text: "제품명 MY-M-11", rows: [] });

    const [, init] = fetcher.mock.calls[0];
    expect(JSON.parse(String(init?.body))).toMatchObject({
      model: "gpt-5-mini"
    });
  });

  it("does not call OpenAI when disabled", async () => {
    const fetcher = vi.fn(async (_input: Parameters<typeof fetch>[0], _init?: Parameters<typeof fetch>[1]) => new Response("{}"));
    const adapter = createOpenAiAdapter({ enabled: false, apiKey: "test-key", fetcher });

    await expect(adapter.extractCandidates({ text: "제품명 A세척제", rows: [] })).resolves.toMatchObject({
      status: "disabled",
      reviewStatus: "needs_review"
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("parses structured output text into registration candidates", async () => {
    const fetcher = vi.fn(async (_input: Parameters<typeof fetch>[0], _init?: Parameters<typeof fetch>[1]) => new Response(JSON.stringify({
      output: [
        {
          type: "message",
          content: [
            {
              type: "output_text",
              text: JSON.stringify({
                productName: "CS-200",
                supplier: "조선선재",
                components: [
                  {
                    casNo: "1344-28-1",
                    chemicalName: "산화 알루미늄",
                    contentMin: "1",
                    contentMax: "5",
                    contentSingle: "",
                    evidence: "SECTION 3 / row 1"
                  }
                ]
              })
            }
          ]
        }
      ]
    })));
    const adapter = createOpenAiAdapter({ enabled: true, apiKey: "test-key", fetcher });

    await expect(adapter.extractCandidates({ text: "산화 알루미늄 1344-28-1 1~5", rows: [] })).resolves.toMatchObject({
      status: "completed",
      candidate: {
        productName: "CS-200",
        supplier: "조선선재",
        components: [
          {
            casNo: "1344-28-1",
            chemicalName: "산화 알루미늄",
            contentMin: "1",
            contentMax: "5"
          }
        ]
      }
    });
  });

  it("keeps user-saved basic info over OpenAI candidates", () => {
    const fields: BasicInfoField[] = [
      { key: "supplier", label: "공급사", value: "사용자 수정값", source: "user_saved" }
    ];

    expect(mergeBasicInfoWithOpenAi(fields, {
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
});
