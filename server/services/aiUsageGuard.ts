export interface AiUsageLimitConfig {
  dailyRequestLimit: number;
  maxPromptChars: number;
  maxOutputTokens: number;
}

export type AiUsageDecision =
  | { allowed: true; remaining: number }
  | { allowed: false; remaining: 0; reason: string };

interface AiUsageGuardState {
  dayKey: string;
  requestCount: number;
}

export function readAiUsageLimitConfig(env: Record<string, string | undefined> = process.env): AiUsageLimitConfig {
  return {
    dailyRequestLimit: readPositiveInteger(env.MSDS_AI_DAILY_REQUEST_LIMIT, 50),
    maxPromptChars: readPositiveInteger(env.MSDS_AI_MAX_PROMPT_CHARS, 20_000),
    maxOutputTokens: readPositiveInteger(env.MSDS_AI_MAX_OUTPUT_TOKENS, 3_000)
  };
}

export function createAiUsageGuard(config: Pick<AiUsageLimitConfig, "dailyRequestLimit">, now: () => Date = () => new Date()) {
  const state: AiUsageGuardState = {
    dayKey: toDayKey(now()),
    requestCount: 0
  };

  return {
    checkAndRecord(): AiUsageDecision {
      const currentDayKey = toDayKey(now());
      if (state.dayKey !== currentDayKey) {
        state.dayKey = currentDayKey;
        state.requestCount = 0;
      }

      if (state.requestCount >= config.dailyRequestLimit) {
        return {
          allowed: false,
          remaining: 0,
          reason: `일일 AI 요청 한도 ${config.dailyRequestLimit}회를 초과했습니다.`
        };
      }

      state.requestCount += 1;
      return {
        allowed: true,
        remaining: Math.max(0, config.dailyRequestLimit - state.requestCount)
      };
    }
  };
}

export function enforcePromptLimit(prompt: string, maxPromptChars: number) {
  if (prompt.length <= maxPromptChars) return prompt;
  return `${prompt.slice(0, maxPromptChars)}\n\n[TRUNCATED_BY_AI_USAGE_GUARD]`;
}

export function getDefaultAiUsageGuard() {
  defaultAiUsageGuard ??= createAiUsageGuard(readAiUsageLimitConfig());
  return defaultAiUsageGuard;
}

let defaultAiUsageGuard: ReturnType<typeof createAiUsageGuard> | undefined;

function readPositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function toDayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}
