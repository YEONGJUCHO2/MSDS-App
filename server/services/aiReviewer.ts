import type { AiReviewStatus, Section3Row } from "../../shared/types";
import { createConfiguredAiAdapter, getAiProviderLabel, resolveAiProvider } from "./aiProvider";

export interface AiReviewedRow extends Section3Row {
  aiReviewStatus: AiReviewStatus;
  aiReviewNote: string;
}

export function reviewComponentRows(rows: Section3Row[]): AiReviewedRow[] {
  return rows.map((row) => {
    const missing = [
      row.casNoCandidate ? "" : "CAS No. 누락",
      row.chemicalNameCandidate ? "" : "물질명 누락",
      row.contentText ? "" : "함유량 누락"
    ].filter(Boolean);

    if (missing.length > 0) {
      return {
        ...row,
        aiReviewStatus: "ai_needs_attention",
        aiReviewNote: missing.join(", ")
      };
    }

    return {
      ...row,
      aiReviewStatus: "ai_candidate",
      aiReviewNote: "CAS No., 물질명, 함유량이 같은 행에서 추출되었습니다."
    };
  });
}

export async function reviewComponentRowsWithOptionalCodex(text: string, rows: Section3Row[]): Promise<AiReviewedRow[]> {
  const localReviewed = reviewComponentRows(rows);
  const providerConfig = resolveAiProvider();
  if (providerConfig.provider === "local") {
    return localReviewed;
  }

  const providerLabel = getAiProviderLabel(providerConfig.provider);
  const adapter = createConfiguredAiAdapter(providerConfig);
  if (!adapter) return localReviewed;

  try {
    const result = await adapter.extractCandidates({ text, rows: localReviewed });
    if (result.status === "disabled") {
      return localReviewed.map((row) => ({
        ...row,
        aiReviewStatus: row.aiReviewStatus,
        aiReviewNote: `${row.aiReviewNote} ${result.message}`
      }));
    }
    const codexCasSet = new Set(result.candidate.components.map((component) => component.casNo).filter(Boolean));
    return localReviewed.map((row) => ({
      ...row,
      aiReviewStatus: codexCasSet.has(row.casNoCandidate) ? "ai_candidate" : row.aiReviewStatus,
      aiReviewNote: codexCasSet.has(row.casNoCandidate)
        ? `${row.aiReviewNote} ${providerLabel} 구조화 결과와 CAS No.가 일치합니다.`
        : `${row.aiReviewNote} ${providerLabel} 구조화 결과에서 동일 CAS No.를 찾지 못했습니다.`
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : `${providerLabel} 호출 실패`;
    return localReviewed.map((row) => ({
      ...row,
      aiReviewStatus: row.aiReviewStatus,
      aiReviewNote: `${row.aiReviewNote} ${providerLabel} 검토 실패: ${message}`
    }));
  }
}
