import type Database from "better-sqlite3";
import type { RegulatoryMatchStatus } from "../../shared/types";
import { deleteRegulatoryMatchesForRow, getComponentRow, insertRegulatoryMatch, updateComponentAiReview, updateComponentCasCandidate, updateComponentRegulatoryStatus, upsertWatchlist } from "../db/repositories";
import { lookupRegulatoryCandidates } from "./regulatoryLookup";
import { isKecoApiConfigured, lookupKecoChemicalInfo } from "./kecoChemicalApiClient";
import { isOfficialApiConfigured, lookupKoshaChemicalInfo } from "./koshaApiClient";
import { isKoshaLawApiConfigured, lookupKoshaLawInfo } from "./koshaLawApiClient";
import { resolveCasNoFromChemicalName } from "./chemicalNameResolver";

export async function matchAndStoreRegulatoryData(
  db: Database.Database,
  documentId: string,
  rows: Array<{ rowId?: string; casNoCandidate: string; chemicalNameCandidate: string }>,
  options: { forceRefresh?: boolean } = {}
) {
  const results: Array<{ rowId: string; seedMatches: number; apiMatches: number; status: RegulatoryMatchStatus }> = [];

  for (const row of rows) {
    if (!row.rowId) continue;
    const resolvedCasNo = row.casNoCandidate || resolveCasNoFromChemicalName(row.chemicalNameCandidate);
    if (!resolvedCasNo) {
      updateComponentRegulatoryStatus(db, row.rowId, chooseStatus(0, 0));
      results.push({ rowId: row.rowId, seedMatches: 0, apiMatches: 0, status: chooseStatus(0, 0) });
      continue;
    }
    const resolvedFromName = !row.casNoCandidate && Boolean(resolvedCasNo);
    if (resolvedFromName) {
      updateComponentCasCandidate(db, row.rowId, resolvedCasNo);
    }
    deleteRegulatoryMatchesForRow(db, row.rowId);

    const seedMatches = lookupRegulatoryCandidates(db, resolvedCasNo);
    for (const match of seedMatches) {
      insertRegulatoryMatch(db, {
        rowId: row.rowId,
        documentId,
        casNo: resolvedCasNo,
        category: match.category,
        status: match.status,
        sourceType: "internal_seed",
        sourceName: match.sourceName,
        sourceUrl: match.sourceUrl,
        evidenceText: `${match.chemicalNameKo} ${match.period}`.trim()
      });
    }

    const officialMatches = await lookupOfficialMatches(db, resolvedCasNo, options.forceRefresh);
    for (const match of officialMatches) {
      insertRegulatoryMatch(db, {
        rowId: row.rowId,
        documentId,
        casNo: resolvedCasNo,
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
    if (shouldClearMissingCasReview(db, row.rowId, resolvedFromName, status)) {
      updateComponentAiReview(db, row.rowId, {
        aiReviewStatus: "ai_candidate",
        aiReviewNote: "물질명으로 CAS No.를 자동 보강했고 공식 API 조회가 완료되었습니다."
      });
    }
    upsertWatchlist(db, {
      casNo: resolvedCasNo,
      chemicalName: row.chemicalNameCandidate,
      sourceName: officialMatches.length > 0 ? officialMatches[0].sourceName : seedMatches.length > 0 ? "내부 기준표" : "조회 대기",
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

  const [result] = await matchAndStoreRegulatoryData(db, documentId, [row], { forceRefresh: true });
  return result;
}

export async function recheckDocumentRegulatoryData(db: Database.Database, documentId: string) {
  const rows = db.prepare(`
    SELECT
      row_id AS rowId,
      cas_no_candidate AS casNoCandidate,
      chemical_name_candidate AS chemicalNameCandidate
    FROM components
    WHERE document_id = ?
    ORDER BY row_index ASC
  `).all(documentId) as Array<{ rowId: string; casNoCandidate: string; chemicalNameCandidate: string }>;
  const results = await matchAndStoreRegulatoryData(db, documentId, rows, { forceRefresh: true });

  return {
    documentId,
    checkedRows: rows.length,
    matchedRows: results.filter((result) => result.status === "official_api_matched" || result.status === "internal_seed_matched").length,
    results
  };
}

export async function recheckWatchlistRegulatoryData(db: Database.Database, watchIds?: string[]) {
  const rows = db.prepare(`
    SELECT
      watch_id AS watchId,
      cas_no AS casNo,
      chemical_name AS chemicalName,
      last_source_name AS lastSourceName,
      last_checked_at AS lastCheckedAt,
      status
    FROM watchlist
    ${watchIds && watchIds.length > 0 ? `WHERE watch_id IN (${watchIds.map(() => "?").join(",")})` : ""}
    ORDER BY last_checked_at DESC
  `).all(...(watchIds ?? [])) as Array<{
    watchId: string;
    casNo: string;
    chemicalName: string;
    lastSourceName: string;
    lastCheckedAt: string;
    status: RegulatoryMatchStatus;
  }>;

  const results: Array<{
    watchId: string;
    casNo: string;
    chemicalName: string;
    seedMatches: number;
    apiMatches: number;
    status: RegulatoryMatchStatus;
    sourceName: string;
    checkedAt: string;
    changed: boolean;
  }> = [];

  for (const row of rows) {
    const seedMatches = lookupRegulatoryCandidates(db, row.casNo);
    const officialMatches = await lookupOfficialMatches(db, row.casNo, true);
    const status = chooseStatus(seedMatches.length, officialMatches.length);
    const sourceName = officialMatches.length > 0 ? officialMatches[0].sourceName : seedMatches.length > 0 ? "내부 기준표" : "조회 대기";
    const checkedAt = new Date().toISOString();
    const changed = row.status !== status || row.lastSourceName !== sourceName;

    upsertWatchlist(db, {
      casNo: row.casNo,
      chemicalName: row.chemicalName,
      sourceName,
      status,
      checkedAt
    });

    results.push({
      watchId: row.watchId,
      casNo: row.casNo,
      chemicalName: row.chemicalName,
      seedMatches: seedMatches.length,
      apiMatches: officialMatches.length,
      status,
      sourceName,
      checkedAt,
      changed
    });
  }

  return results;
}

export async function lookupOfficialMatches(db: Database.Database, casNo: string, forceRefresh = false) {
  let kecoMatches: Awaited<ReturnType<typeof lookupKecoChemicalInfo>>["matches"] = [];
  try {
    kecoMatches = (await lookupKecoChemicalInfo(db, casNo, fetch, { forceRefresh })).matches;
  } catch {
    kecoMatches = [];
  }

  let koshaLawMatches: Awaited<ReturnType<typeof lookupKoshaLawInfo>>["matches"] = [];
  try {
    koshaLawMatches = (await lookupKoshaLawInfo(db, casNo, fetch, { forceRefresh })).matches;
  } catch {
    koshaLawMatches = [];
  }

  const regulationMatches = [...kecoMatches, ...koshaLawMatches];
  if (regulationMatches.length > 0) return regulationMatches;

  try {
    return (await lookupKoshaChemicalInfo(db, casNo, fetch, { forceRefresh })).matches;
  } catch {
    return [];
  }
}

export function chooseStatus(seedMatches: number, officialMatches: number): RegulatoryMatchStatus {
  if (officialMatches > 0) return "official_api_matched";
  if (seedMatches > 0) return "internal_seed_matched";
  if (!isKecoApiConfigured() && !isOfficialApiConfigured() && !isKoshaLawApiConfigured()) return "api_key_required";
  return "no_match";
}

function shouldClearMissingCasReview(db: Database.Database, rowId: string, resolvedFromName: boolean, status: RegulatoryMatchStatus) {
  if (status !== "official_api_matched") return false;
  if (resolvedFromName) return true;
  const row = getComponentRow(db, rowId);
  return row?.aiReviewStatus === "ai_needs_attention" && row.aiReviewNote.includes("CAS No. 누락");
}
