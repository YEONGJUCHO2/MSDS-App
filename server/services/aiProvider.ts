import { createCodexAdapter } from "./codexAdapter";
import { createOpenAiAdapter } from "./openAiAdapter";

export type AiProviderName = "local" | "codex" | "openai";

export interface AiProviderConfig {
  provider: AiProviderName;
  model?: string;
  reasoningEffort?: string;
  configured: boolean;
}

type EnvLike = Record<string, string | undefined>;

export function resolveAiProvider(env: EnvLike = process.env): AiProviderConfig {
  const explicitProvider = (env.MSDS_AI_PROVIDER ?? "").trim().toLowerCase();

  if (explicitProvider === "openai") {
    return {
      provider: "openai",
      model: env.MSDS_AI_MODEL?.trim() || "gpt-5-mini",
      configured: Boolean(env.OPENAI_API_KEY?.trim())
    };
  }

  if (explicitProvider === "codex" || env.MSDS_CODEX_ENABLED === "true") {
    return {
      provider: "codex",
      model: env.MSDS_CODEX_MODEL?.trim() || undefined,
      reasoningEffort: env.MSDS_CODEX_REASONING_EFFORT?.trim() || undefined,
      configured: true
    };
  }

  return {
    provider: "local",
    configured: false
  };
}

export function createConfiguredAiAdapter(config: AiProviderConfig, env: EnvLike = process.env) {
  if (config.provider === "openai") {
    return createOpenAiAdapter({
      enabled: config.configured,
      apiKey: env.OPENAI_API_KEY,
      model: config.model,
      baseUrl: env.OPENAI_API_BASE_URL || undefined,
      timeoutMs: Number(env.MSDS_AI_TIMEOUT_MS || 60_000)
    });
  }

  if (config.provider === "codex") {
    return createCodexAdapter({
      enabled: true,
      command: env.MSDS_CODEX_COMMAND || "codex",
      model: config.model,
      reasoningEffort: config.reasoningEffort,
      timeoutMs: Number(env.MSDS_CODEX_TIMEOUT_MS || 60_000)
    });
  }

  return null;
}

export function getAiProviderLabel(provider: AiProviderName) {
  if (provider === "openai") return "OpenAI API";
  if (provider === "codex") return "Codex CLI";
  return "로컬 파서";
}
