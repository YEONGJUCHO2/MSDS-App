import { spawn } from "node:child_process";
import { registrationCandidateSchema, type RegistrationCandidate } from "../domain/registrationSchema";
import type { Section3Row } from "../../shared/types";

export interface CodexExtractionInput {
  text: string;
  rows: Section3Row[];
}

export type CodexExtractionResult =
  | { status: "disabled"; reviewStatus: "needs_review"; candidate: RegistrationCandidate; message: string }
  | { status: "completed"; reviewStatus: "needs_review"; candidate: RegistrationCandidate; message: string };

export function createCodexAdapter(options: { enabled: boolean; command?: string }) {
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
          message: "Codex CLI 실행이 비활성화되어 로컬 파서 후보만 검수 큐에 올렸습니다."
        };
      }

      const stdout = await runCodex(options.command ?? "codex", input);
      const parsed = registrationCandidateSchema.parse(JSON.parse(stdout));
      return {
        status: "completed",
        reviewStatus: "needs_review",
        candidate: parsed,
        message: "Codex CLI 후보값 구조화를 완료했습니다."
      };
    }
  };
}

function runCodex(command: string, input: CodexExtractionInput) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(command, ["exec", "--json"], { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(stderr || `Codex CLI exited with code ${code}`));
      }
    });

    child.stdin.write(JSON.stringify({
      instruction: "MSDS 추출 텍스트와 SECTION 3 행을 사내 등록 후보 JSON으로 구조화하라. 법적 최종판정은 하지 말고 검수필요 후보로 표시하라.",
      input
    }));
    child.stdin.end();
  });
}
