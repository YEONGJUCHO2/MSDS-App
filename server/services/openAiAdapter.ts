import { registrationCandidateSchema, type RegistrationCandidate } from "../domain/registrationSchema";
import type { BasicInfoField, Section3Row } from "../../shared/types";
import {
  enforcePromptLimit,
  getDefaultAiUsageGuard,
  readAiUsageLimitConfig,
  type AiUsageLimitConfig
} from "./aiUsageGuard";

export interface OpenAiExtractionInput {
  text: string;
  rows: Section3Row[];
}

export type OpenAiExtractionResult =
  | { status: "disabled"; reviewStatus: "needs_review"; candidate: RegistrationCandidate; message: string }
  | { status: "completed"; reviewStatus: "needs_review"; candidate: RegistrationCandidate; message: string };

interface OpenAiAdapterOptions {
  enabled: boolean;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  timeoutMs?: number;
  fetcher?: typeof fetch;
  usageGuard?: ReturnType<typeof getDefaultAiUsageGuard>;
  limits?: AiUsageLimitConfig;
}

export function createOpenAiAdapter(options: OpenAiAdapterOptions) {
  return {
    async extractCandidates(input: OpenAiExtractionInput): Promise<OpenAiExtractionResult> {
      const fallbackCandidate = registrationCandidateSchema.parse({
        components: input.rows.map((row) => ({
          casNo: row.casNoCandidate,
          chemicalName: row.chemicalNameCandidate,
          contentMin: row.contentMinCandidate,
          contentMax: row.contentMaxCandidate,
          contentSingle: row.contentSingleCandidate,
          evidence: `${row.evidenceLocation}: ${row.rawRowText}`
        }))
      });

      if (!options.enabled || !options.apiKey?.trim()) {
        return {
          status: "disabled",
          reviewStatus: "needs_review",
          candidate: fallbackCandidate,
          message: "OpenAI API가 비활성화되어 로컬 파서 후보를 사용했습니다."
        };
      }

      const parsed = await requestRegistrationCandidate(options, buildRegistrationPrompt(input));
      return {
        status: "completed",
        reviewStatus: "needs_review",
        candidate: parsed,
        message: "OpenAI API 후보값 구조화를 완료했습니다."
      };
    },

    async enrichBasicInfo(input: { text: string; localFields: BasicInfoField[] }) {
      if (!options.enabled || !options.apiKey?.trim()) return input.localFields;

      const parsed = await requestRegistrationCandidate(options, buildBasicInfoPrompt(input.text, input.localFields));
      return mergeBasicInfoWithOpenAi(input.localFields, parsed);
    }
  };
}

export function mergeBasicInfoWithOpenAi(localFields: BasicInfoField[], candidate: RegistrationCandidate) {
  const valuesByKey: Record<string, string> = {
    supplier: candidate.supplier,
    manufacturer: candidate.manufacturer,
    phone: candidate.phone,
    email: candidate.email,
    productName: candidate.productName,
    usage: candidate.use,
    msdsNumber: candidate.msdsNumber,
    revisionDate: candidate.revisionDate
  };

  return localFields.map((field) => {
    const openAiValue = valuesByKey[field.key]?.trim();
    if (!openAiValue) return field;
    if (field.value.trim() && field.source === "user_saved") return field;
    return {
      ...field,
      value: openAiValue,
      source: "openai_api" as const
    };
  });
}

async function requestRegistrationCandidate(options: OpenAiAdapterOptions, prompt: string) {
  const limits = options.limits ?? readAiUsageLimitConfig();
  const usageDecision = (options.usageGuard ?? getDefaultAiUsageGuard()).checkAndRecord();
  if (!usageDecision.allowed) {
    throw new Error(usageDecision.reason);
  }

  const response = await runOpenAiResponse(options, {
    model: options.model?.trim() || "gpt-5-mini",
    input: [
      {
        role: "system",
        content: "You extract MSDS registration candidates. Return only JSON that matches the supplied schema. Do not make legal final decisions."
      },
      {
        role: "user",
        content: enforcePromptLimit(prompt, limits.maxPromptChars)
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "msds_registration_candidate",
        strict: true,
        schema: registrationCandidateJsonSchema
      }
    },
    max_output_tokens: limits.maxOutputTokens
  });

  return registrationCandidateSchema.parse(parseAiJsonObject(extractOutputText(response)));
}

async function runOpenAiResponse(options: OpenAiAdapterOptions, body: unknown) {
  const fetcher = options.fetcher ?? fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 60_000);

  try {
    const response = await fetcher(`${(options.baseUrl ?? "https://api.openai.com/v1").replace(/\/+$/, "")}/responses`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${options.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = typeof payload?.error?.message === "string" ? payload.error.message : `OpenAI API returned ${response.status}`;
      throw new Error(message);
    }
    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

function extractOutputText(payload: unknown) {
  const item = payload as Record<string, unknown>;
  if (typeof item.output_text === "string") return item.output_text;

  const texts: string[] = [];
  const output = Array.isArray(item.output) ? item.output : [];
  for (const outputItem of output) {
    const content = Array.isArray((outputItem as Record<string, unknown>).content)
      ? (outputItem as Record<string, unknown>).content as Record<string, unknown>[]
      : [];
    for (const contentItem of content) {
      if (typeof contentItem.refusal === "string" && contentItem.refusal.trim()) {
        throw new Error(`OpenAI refused the request: ${contentItem.refusal}`);
      }
      if (typeof contentItem.text === "string") texts.push(contentItem.text);
    }
  }

  if (texts.length === 0) {
    throw new Error("OpenAI response did not contain output text.");
  }
  return texts.join("\n");
}

function parseAiJsonObject(output: string) {
  const trimmed = output.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) {
      throw new Error("OpenAI response did not contain a JSON object.");
    }
    return JSON.parse(trimmed.slice(start, end + 1)) as unknown;
  }
}

function buildRegistrationPrompt(input: OpenAiExtractionInput) {
  return [
    "MSDS 원문과 SECTION 3 성분표 후보를 사내 등록 후보 JSON으로 구조화한다.",
    "원문에서 확인되지 않는 값은 빈 문자열로 둔다. 추측하지 않는다.",
    "함유량 범위는 MIN/MAX로 분리하고, 단일값은 contentSingle에 둔다.",
    "입력:",
    JSON.stringify({
      text: clipText(input.text),
      rows: input.rows.map((row) => ({
        casNo: row.casNoCandidate,
        chemicalName: row.chemicalNameCandidate,
        contentMin: row.contentMinCandidate,
        contentMax: row.contentMaxCandidate,
        contentSingle: row.contentSingleCandidate,
        evidence: `${row.evidenceLocation}: ${row.rawRowText}`
      }))
    })
  ].join("\n");
}

function buildBasicInfoPrompt(text: string, localFields: BasicInfoField[]) {
  return [
    "MSDS 문서의 1번 항목과 표지에서 물품 기본정보 후보를 추출한다.",
    "생산 및 공급 회사명, 제조-공급회사명, 제조자/공급자 정보는 공급사/제조사 후보로 사용할 수 있다.",
    "원문에 없는 값은 빈 문자열로 둔다.",
    "룰 기반 후보:",
    JSON.stringify(localFields.map(({ key, label, value }) => ({ key, label, value }))),
    "MSDS 원문:",
    clipText(text)
  ].join("\n");
}

function clipText(text: string) {
  const normalized = text.replace(/\r/g, "\n").trim();
  return normalized.length > 18_000 ? `${normalized.slice(0, 18_000)}\n\n[TRUNCATED]` : normalized;
}

const registrationCandidateJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "productName",
    "supplier",
    "manufacturer",
    "phone",
    "email",
    "use",
    "msdsNumber",
    "revisionDate",
    "revisionVersion",
    "components"
  ],
  properties: {
    productName: { type: "string" },
    supplier: { type: "string" },
    manufacturer: { type: "string" },
    phone: { type: "string" },
    email: { type: "string" },
    use: { type: "string" },
    msdsNumber: { type: "string" },
    revisionDate: { type: "string" },
    revisionVersion: { type: "string" },
    components: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["casNo", "chemicalName", "contentMin", "contentMax", "contentSingle", "evidence", "reviewStatus"],
        properties: {
          casNo: { type: "string" },
          chemicalName: { type: "string" },
          contentMin: { type: "string" },
          contentMax: { type: "string" },
          contentSingle: { type: "string" },
          evidence: { type: "string" },
          reviewStatus: { type: "string", enum: ["needs_review", "approved", "edited", "excluded"] }
        }
      }
    }
  }
};
