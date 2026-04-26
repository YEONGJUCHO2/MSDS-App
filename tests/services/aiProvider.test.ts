import { describe, expect, it } from "vitest";
import { resolveAiProvider } from "../../server/services/aiProvider";

describe("AI provider", () => {
  it("selects OpenAI when explicitly configured", () => {
    expect(resolveAiProvider({ MSDS_AI_PROVIDER: "openai", OPENAI_API_KEY: "key" })).toMatchObject({
      provider: "openai",
      model: "gpt-5-mini"
    });
  });

  it("selects Codex when explicitly configured", () => {
    expect(resolveAiProvider({ MSDS_AI_PROVIDER: "codex" })).toMatchObject({
      provider: "codex"
    });
  });

  it("keeps the legacy Codex flag working", () => {
    expect(resolveAiProvider({ MSDS_CODEX_ENABLED: "true" })).toMatchObject({
      provider: "codex"
    });
  });

  it("stays local-only when no provider is configured", () => {
    expect(resolveAiProvider({})).toMatchObject({
      provider: "local"
    });
  });
});
