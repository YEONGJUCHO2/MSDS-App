import type Database from "better-sqlite3";
import type { RegulatoryMatchStatus } from "../../shared/types";
import { deleteRegulatoryMatchesForRow, getComponentRow, insertRegulatoryMatch, updateComponentRegulatoryStatus, upsertWatchlist } from "../db/repositories";
import { lookupRegulatoryCandidates } from "./regulatoryLookup";
import { isKecoApiConfigured, lookupKecoChemicalInfo } from "./kecoChemicalApiClient";

export async function matchAndStoreRegulatoryData(
  db: Database.Database,
  documentId: string,
  rows: Array<{ rowId?: string; casNoCandidate: string; chemicalNameCandidate: string }>
) {
  const results: Array<{ rowId: string; seedMatches: number; apiMatches: number; status: RegulatoryMatchStatus }> = [];

  for (const row of rows) {
    if (!row.rowId || !row.casNoCandidate) continue;
    deleteRegulatoryMatchesForRow(db, row.rowId);

    const seedMatches = lookupRegulatoryCandidates(db, row.casNoCandidate);
    for (const match of seedMatches) {
      insertRegulatoryMatch(db, {
        rowId: row.rowId,
        documentId,
        casNo: row.casNoCandidate,
        category: match.category,
        status: match.status,
        sourceType: "internal_seed",
        sourceName: match.sourceName,
        sourceUrl: match.sourceUrl,
        evidenceText: `${match.chemicalNameKo} ${match.period}`.trim()
      });
    }

    const officialLookup = await lookupKecoChemicalInfo(db, row.casNoCandidate);
    const officialMatches = officialLookup.matches;
    for (const match of officialMatches) {
      insertRegulatoryMatch(db, {
        rowId: row.rowId,
        documentId,
        casNo: row.casNoCandidate,
        category: match.category,
        status: "공식 API 조회됨",
        sourceType: "official_api",
        sourceName: match.sourceName,
        sourceUrl: match.sourceUrl,
        evidenceText: match.evidenceText
      });
    }

    const status = chooseStatus(seedMatches.length, officialMatches.length);
    updateComponentRegulatoryStatus(db, row.rowId, status);
    upsertWatchlist(db, {
      casNo: row.casNoCandidate,
      chemicalName: row.chemicalNameCandidate,
      sourceName: officialMatches.length > 0 ? "한국환경공단 화학물질 정보 조회 서비스" : seedMatches.length > 0 ? "내부 기준표" : "조회 대기",
      status
    });
    results.push({ rowId: row.rowId, seedMatches: seedMatches.length, apiMatches: officialMatches.length, status });
  }

  return results;
}

export async function recheckComponentRegulatoryData(db: Database.Database, documentId: string, rowId: string) {
  const row = getComponentRow(db, rowId);
  if (!row || row.documentId !== documentId) {
    throw new Error("Component row not found");
  }

  const [result] = await matchAndStoreRegulatoryData(db, documentId, [row]);
  return result;
}

function chooseStatus(seedMatches: number, officialMatches: number): RegulatoryMatchStatus {
  if (officialMatches > 0) return "official_api_matched";
  if (seedMatches > 0) return "internal_seed_matched";
  if (!isKecoApiConfigured()) return "api_key_required";
  return "no_match";
}
