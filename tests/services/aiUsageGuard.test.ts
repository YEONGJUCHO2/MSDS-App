import { describe, expect, it } from "vitest";
import { createAiUsageGuard, enforcePromptLimit, readAiUsageLimitConfig } from "../../server/services/aiUsageGuard";

describe("AI usage guard", () => {
  it("blocks OpenAI calls after the daily request limit is reached", () => {
    const guard = createAiUsageGuard({ dailyRequestLimit: 2 });

    expect(guard.checkAndRecord()).toMatchObject({ allowed: true, remaining: 1 });
    expect(guard.checkAndRecord()).toMatchObject({ allowed: true, remaining: 0 });
    expect(guard.checkAndRecord()).toMatchObject({
      allowed: false,
      reason: "일일 AI 요청 한도 2회를 초과했습니다."
    });
  });

  it("clips prompts to the configured maximum character count", () => {
    expect(enforcePromptLimit("1234567890", 6)).toBe("123456\n\n[TRUNCATED_BY_AI_USAGE_GUARD]");
  });

  it("reads conservative defaults from environment variables", () => {
    expect(readAiUsageLimitConfig({
      MSDS_AI_DAILY_REQUEST_LIMIT: "50",
      MSDS_AI_MAX_PROMPT_CHARS: "20000",
      MSDS_AI_MAX_OUTPUT_TOKENS: "3000"
    })).toEqual({
      dailyRequestLimit: 50,
      maxPromptChars: 20000,
      maxOutputTokens: 3000
    });
  });
});
