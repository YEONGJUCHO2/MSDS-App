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
    const aiRows = result.candidate.components
      .filter((component) => component.casNo.trim() || component.chemicalName.trim())
      .map((component, index): AiReviewedRow => {
        const contentText = formatContentText(component.contentMin, component.contentMax, component.contentSingle);
        return {
          rowIndex: index,
          rawRowText: component.evidence || [component.chemicalName, component.casNo, contentText].filter(Boolean).join(" "),
          casNoCandidate: component.casNo.trim(),
          chemicalNameCandidate: component.chemicalName.trim(),
          contentMinCandidate: component.contentMin.trim(),
          contentMaxCandidate: component.contentMax.trim(),
          contentSingleCandidate: component.contentSingle.trim(),
          contentText,
          confidence: contentText && component.casNo.trim() && component.chemicalName.trim() ? 0.9 : 0.68,
          evidenceLocation: component.evidence ? `${providerLabel} 구조화 / row ${index + 1}` : `${providerLabel} 구조화`,
          reviewStatus: component.reviewStatus,
          aiReviewStatus: missingFields(component).length > 0 ? "ai_needs_attention" : "ai_candidate",
          aiReviewNote: missingFields(component).length > 0
            ? `${providerLabel} 구조화 결과를 사내 입력 후보로 사용했습니다. ${missingFields(component).join(", ")}`
            : `${providerLabel} 구조화 결과를 사내 입력 후보로 사용했습니다.`
        };
      });

    return aiRows.length > 0 ? aiRows : localReviewed.map((row) => ({
      ...row,
      aiReviewNote: `${row.aiReviewNote} ${providerLabel} 구조화 결과에서 사용할 성분 후보를 찾지 못해 로컬 파서 후보를 유지했습니다.`
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

function formatContentText(contentMin: string, contentMax: string, contentSingle: string) {
  const single = contentSingle.trim();
  if (single) return single;
  const min = contentMin.trim();
  const max = contentMax.trim();
  if (min || max) return `${min}~${max}`.replace(/^~/, "").replace(/~$/, "");
  return "";
}

function missingFields(component: { casNo: string; chemicalName: string; contentMin: string; contentMax: string; contentSingle: string }) {
  return [
    component.casNo.trim() ? "" : "CAS No. 누락",
    component.chemicalName.trim() ? "" : "물질명 누락",
    formatContentText(component.contentMin, component.contentMax, component.contentSingle) ? "" : "함유량 누락"
  ].filter(Boolean);
}
