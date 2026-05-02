import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { registrationCandidateSchema, type RegistrationCandidate } from "../domain/registrationSchema";
import type { BasicInfoField, Section3Row } from "../../shared/types";

export interface CodexExtractionInput {
  text: string;
  rows: Section3Row[];
}

export type CodexExtractionResult =
  | { status: "disabled"; reviewStatus: "needs_review"; candidate: RegistrationCandidate; message: string }
  | { status: "completed"; reviewStatus: "needs_review"; candidate: RegistrationCandidate; message: string };

interface CodexAdapterOptions {
  enabled: boolean;
  command?: string;
  model?: string;
  reasoningEffort?: string;
  timeoutMs?: number;
  runner?: (prompt: string) => Promise<string>;
  spawnRunner?: (command: string, args: string[], prompt: string, timeoutMs: number) => Promise<string>;
}

export function createCodexAdapter(options: CodexAdapterOptions) {
  return {
    async extractCandidates(input: CodexExtractionInput): Promise<CodexExtractionResult> {
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

      if (!options.enabled) {
        return {
          status: "disabled",
          reviewStatus: "needs_review",
          candidate: fallbackCandidate,
          message: "Codex CLI 실행이 비활성화되어 로컬 파서 후보 중 확인이 필요한 항목만 큐에 올렸습니다."
        };
      }

      const stdout = options.runner
        ? await options.runner(buildRegistrationPrompt(input))
        : await runCodex(options.command ?? "codex", buildRegistrationPrompt(input), options);
      const parsed = registrationCandidateSchema.parse(parseJsonObject(stdout));
      return {
        status: "completed",
        reviewStatus: "needs_review",
        candidate: parsed,
        message: "Codex CLI 후보값 구조화를 완료했습니다."
      };
    },

    async enrichBasicInfo(input: { text: string; localFields: BasicInfoField[] }) {
      if (!options.enabled) return input.localFields;

      const stdout = options.runner
        ? await options.runner(buildBasicInfoPrompt(input.text, input.localFields))
        : await runCodex(options.command ?? "codex", buildBasicInfoPrompt(input.text, input.localFields), options);
      const parsed = registrationCandidateSchema.parse(parseJsonObject(stdout));
      return mergeBasicInfoWithCodex(input.localFields, parsed);
    }
  };
}

export function mergeBasicInfoWithCodex(localFields: BasicInfoField[], candidate: RegistrationCandidate) {
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
    const codexValue = valuesByKey[field.key]?.trim();
    if (!codexValue) return field;
    if (field.value.trim() && field.source === "user_saved") return field;
    return {
      ...field,
      value: codexValue,
      source: "codex_cli" as const
    };
  });
}

export function parseJsonObject(output: string) {
  const trimmed = output.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) {
      throw new Error("Codex CLI response did not contain a JSON object.");
    }
    return JSON.parse(trimmed.slice(start, end + 1)) as unknown;
  }
}

async function runCodex(command: string, prompt: string, options: CodexAdapterOptions) {
  const tempDir = await mkdtemp(path.join(tmpdir(), "msds-codex-"));
  const outputFile = path.join(tempDir, "last-message.json");

  try {
    return await new Promise<string>((resolve, reject) => {
      const args = [
        "exec",
        "--sandbox",
        "read-only",
        "--cd",
        process.cwd(),
        "--output-last-message",
        outputFile
      ];
      if (options.model) args.push("--model", options.model);
      if (options.reasoningEffort) args.push("--config", `model_reasoning_effort="${options.reasoningEffort}"`);
      args.push("-");

      if (options.spawnRunner) {
        options.spawnRunner(command, args, prompt, options.timeoutMs ?? 60_000).then(resolve, reject);
        return;
      }

      const child = spawn(command, args, { stdio: ["pipe", "pipe", "pipe"] });
      const timeout = setTimeout(() => {
        child.kill("SIGTERM");
        reject(new Error("Codex CLI timed out."));
      }, options.timeoutMs ?? 60_000);

      let stderr = "";
      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });
      child.on("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });
      child.on("close", async (code) => {
        clearTimeout(timeout);
        if (code !== 0) {
          reject(new Error(stderr || `Codex CLI exited with code ${code}`));
          return;
        }
        try {
          resolve(await readFile(outputFile, "utf8"));
        } catch (error) {
          reject(error);
        }
      });

      child.stdin.write(prompt);
      child.stdin.end();
    });
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
}

function buildRegistrationPrompt(input: CodexExtractionInput) {
  return [
    "너는 MSDS 문서를 사내 등록 후보 JSON으로 구조화하는 보조 도구다.",
    "법적 최종판정은 하지 말고, 원문에서 확인되는 후보만 추출한다.",
    "반드시 JSON 객체 하나만 반환한다. 마크다운, 설명, 코드펜스를 붙이지 않는다.",
    "스키마: {\"productName\":\"\",\"supplier\":\"\",\"manufacturer\":\"\",\"phone\":\"\",\"email\":\"\",\"use\":\"\",\"msdsNumber\":\"\",\"revisionDate\":\"YYYY-MM-DD 또는 원문값\",\"revisionVersion\":\"\",\"components\":[{\"casNo\":\"\",\"chemicalName\":\"\",\"contentMin\":\"\",\"contentMax\":\"\",\"contentSingle\":\"\",\"evidence\":\"\",\"reviewStatus\":\"needs_review\"}]}",
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
    "너는 MSDS 문서의 1번 항목(화학제품과 회사에 관한 정보)을 사내 등록 기본정보 JSON으로 구조화하는 보조 도구다.",
    "원문에 없는 값은 빈 문자열로 둔다. 추측하지 않는다.",
    "생산 및 공급 회사명, 제조-공급회사명, 제조자/공급자 정보는 공급사/제조사 후보로 사용할 수 있다.",
    "반드시 JSON 객체 하나만 반환한다. 마크다운, 설명, 코드펜스를 붙이지 않는다.",
    "스키마: {\"productName\":\"\",\"supplier\":\"\",\"manufacturer\":\"\",\"phone\":\"\",\"email\":\"\",\"use\":\"\",\"msdsNumber\":\"\",\"revisionDate\":\"YYYY-MM-DD 또는 원문값\",\"revisionVersion\":\"\",\"components\":[]}",
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
