import type Database from "better-sqlite3";
import { getChemicalApiCache, upsertChemicalApiCache } from "../db/repositories";
import type { OfficialChemicalMatch } from "./koshaApiClient";

type Fetcher = (url: string) => Promise<{ ok: boolean; text(): Promise<string>; status?: number }>;

export async function lookupKecoChemicalInfo(db: Database.Database, casNo: string, fetcher: Fetcher = fetch) {
  const cached = getChemicalApiCache(db, "keco", casNo);
  if (cached && new Date(cached.expiresAt).getTime() > Date.now()) {
    return {
      cacheStatus: "hit" as const,
      matches: parseKecoResponse(casNo, cached.responseText, cached.requestUrl)
    };
  }

  const endpoint = process.env.KECO_CHEM_API_URL;
  const serviceKey = process.env.KECO_API_SERVICE_KEY;
  if (!endpoint || !serviceKey) {
    return { cacheStatus: "not_configured" as const, matches: [] as OfficialChemicalMatch[] };
  }

  const url = buildKecoUrl(endpoint, serviceKey, casNo);
  const response = await fetcher(url.toString());
  const responseText = await response.text();
  if (!response.ok) {
    upsertChemicalApiCache(db, {
      provider: "keco",
      casNo,
      requestUrl: url.toString(),
      responseText,
      status: `http_${response.status ?? "error"}`,
      ttlDays: 1
    });
    throw new Error(`KECO chemical API lookup failed: ${response.status ?? "unknown"}`);
  }

  upsertChemicalApiCache(db, {
    provider: "keco",
    casNo,
    requestUrl: url.toString(),
    responseText,
    status: "ok"
  });

  return {
    cacheStatus: "miss" as const,
    matches: parseKecoResponse(casNo, responseText, url.toString())
  };
}

export function isKecoApiConfigured() {
  return Boolean(process.env.KECO_CHEM_API_URL && process.env.KECO_API_SERVICE_KEY);
}

function buildKecoUrl(endpoint: string, serviceKey: string, casNo: string) {
  const url = new URL(endpoint);
  url.searchParams.set("serviceKey", serviceKey);
  url.searchParams.set("casNo", casNo);
  url.searchParams.set("searchWrd", casNo);
  url.searchParams.set("numOfRows", "10");
  url.searchParams.set("pageNo", "1");
  url.searchParams.set("_type", "json");
  url.searchParams.set("type", "json");
  return url;
}

function parseKecoResponse(casNo: string, responseText: string, sourceUrl: string): OfficialChemicalMatch[] {
  const trimmed = responseText.trim();
  if (!trimmed) return [];

  const parsed = tryParseJson(trimmed);
  if (!parsed) {
    return [{
      casNo,
      category: "chemicalInfoLookup",
      sourceName: "한국환경공단 화학물질 정보 조회 서비스",
      sourceUrl,
      evidenceText: trimmed.slice(0, 1000)
    }];
  }

  const items = normalizeItems(parsed);
  if (items.length === 0) return [];

  return items.map((item) => ({
    casNo: String(item.casNo ?? item.cas_no ?? casNo),
    category: "chemicalInfoLookup",
    sourceName: "한국환경공단 화학물질 정보 조회 서비스",
    sourceUrl,
    evidenceText: summarizeItem(item)
  }));
}

function tryParseJson(text: string) {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function normalizeItems(value: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(value)) return value.filter(isRecord);
  if (!isRecord(value)) return [];
  const response = value.response;
  const body = isRecord(response) ? response.body : value.body;
  const items = isRecord(body) ? body.items : value.items;
  if (Array.isArray(items)) return items.filter(isRecord);
  if (isRecord(items)) {
    const item = items.item;
    if (Array.isArray(item)) return item.filter(isRecord);
    if (isRecord(item)) return [item];
    return [items];
  }
  const item = isRecord(body) ? body.item : undefined;
  if (Array.isArray(item)) return item.filter(isRecord);
  if (isRecord(item)) return [item];
  return [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function summarizeItem(item: Record<string, unknown>) {
  const parts = [
    valueOf(item, ["chemNmKor", "chemNameKor", "korNm", "chemNmKr", "물질명국문"]),
    valueOf(item, ["chemNmEng", "chemNameEng", "engNm", "물질명영문"]),
    valueOf(item, ["keNo", "ke_no", "KE_NO"]),
    valueOf(item, ["molFoml", "molecularFormula", "분자식"]),
    valueOf(item, ["molWt", "molecularWeight", "분자량"])
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" / ") : JSON.stringify(item).slice(0, 1000);
}

function valueOf(item: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = item[key];
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim();
    }
  }
  return "";
}
