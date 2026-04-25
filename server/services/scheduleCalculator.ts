import type { RegulatoryCandidate } from "../../shared/types";

export function calculateScheduleFlags(candidates: RegulatoryCandidate[]) {
  return candidates
    .filter((candidate) => candidate.period)
    .map((candidate) => ({
      casNo: candidate.casNo,
      category: candidate.category,
      period: candidate.period,
      nextAction: `${candidate.chemicalNameKo} ${candidate.period} 주기 확인`
    }));
}
