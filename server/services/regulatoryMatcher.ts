import type Database from "better-sqlite3";
import type { RegulatoryMatchStatus } from "../../shared/types";
import { deleteRegulatoryMatchesForRow, getComponentRow, insertRegulatoryMatch, updateComponentRegulatoryStatus, upsertWatchlist } from "../db/repositories";
import { lookupRegulatoryCandidates } from "./regulatoryLookup";
import { isKecoApiConfigured, lookupKecoChemicalInfo } from "./kecoChemicalApiClient";
import { isOfficialApiConfigured, lookupKoshaChemicalInfo } from "./koshaApiClient";

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

    const officialMatches = await lookupOfficialMatches(db, row.casNoCandidate);
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

  const [result] = await matchAndStoreRegulatoryData(db, documentId, [row]);
  return result;
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

  if (kecoMatches.length > 0) return kecoMatches;

  try {
    return (await lookupKoshaChemicalInfo(db, casNo, fetch, { forceRefresh })).matches;
  } catch {
    return [];
  }
}

export function chooseStatus(seedMatches: number, officialMatches: number): RegulatoryMatchStatus {
  if (officialMatches > 0) return "official_api_matched";
  if (seedMatches > 0) return "internal_seed_matched";
  if (!isKecoApiConfigured() && !isOfficialApiConfigured()) return "api_key_required";
  return "no_match";
}
