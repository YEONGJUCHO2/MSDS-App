import type Database from "better-sqlite3";
import { getChemicalApiCache, upsertChemicalApiCache } from "../db/repositories";
import type { OfficialChemicalMatch } from "./koshaApiClient";

type Fetcher = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: URLSearchParams; signal?: AbortSignal }
) => Promise<{ ok: boolean; text(): Promise<string>; status?: number }>;

interface KoshaLawLookupPayload {
  chemId: string;
  casNo: string;
  detail: unknown;
}

const DEFAULT_KOSHA_LAW_BASE_URL = "https://msds.kosha.or.kr/MSDSInfo/kcic";

export function isKoshaLawApiConfigured() {
  return process.env.KOSHA_LAW_API_BASE_URL !== "false";
}

export async function lookupKoshaLawInfo(db: Database.Database, casNo: string, fetcher: Fetcher = fetch, options: { forceRefresh?: boolean } = {}) {
  if (!isKoshaLawApiConfigured()) {
    return { cacheStatus: "not_configured" as const, matches: [] as OfficialChemicalMatch[] };
  }

  const cached = getChemicalApiCache(db, "kosha_law", casNo);
  if (!options.forceRefresh && cached?.status === "ok" && new Date(cached.expiresAt).getTime() > Date.now()) {
    return {
      cacheStatus: "hit" as const,
      matches: parseKoshaLawPayload(casNo, cached.responseText, cached.requestUrl)
    };
  }

  const baseUrl = normalizeBaseUrl(process.env.KOSHA_LAW_API_BASE_URL || DEFAULT_KOSHA_LAW_BASE_URL);
  const searchUrl = `${baseUrl}/msdssearchLaw.do`;
  const detailUrl = `${baseUrl}/msdsdetailLaw.do`;

  let payload: KoshaLawLookupPayload;
  try {
    const chemId = await findChemIdByCas(searchUrl, casNo, fetcher);
    if (!chemId) {
      payload = { chemId: "", casNo, detail: { resultLawDetail: [] } };
    } else {
      const detail = await fetchLawDetail(detailUrl, chemId, casNo, fetcher);
      payload = { chemId, casNo, detail };
    }
  } catch (error) {
    upsertChemicalApiCache(db, {
      provider: "kosha_law",
      casNo,
      requestUrl: detailUrl,
      responseText: error instanceof Error ? error.message : "lookup failed",
      status: error instanceof Error && error.message.includes("timed out") ? "timeout" : "network_error",
      ttlDays: 1
    });
    throw error;
  }

  const responseText = JSON.stringify(payload);
  upsertChemicalApiCache(db, {
    provider: "kosha_law",
    casNo,
    requestUrl: detailUrl,
    responseText,
    status: "ok"
  });

  return {
    cacheStatus: "miss" as const,
    matches: parseKoshaLawPayload(casNo, responseText, detailUrl)
  };
}

function normalizeBaseUrl(value: string) {
  return value.replace(/\/$/, "");
}

async function findChemIdByCas(searchUrl: string, casNo: string, fetcher: Fetcher) {
  const response = await fetchWithTimeout(searchUrl, fetcher, "KOSHA law search", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded; charset=UTF-8" },
    body: new URLSearchParams({
      listType: "law",
      pageIndex: "1",
      pageSizeUser: "10",
      searchCondition: "cas_no",
      searchKeyword: casNo,
      chkAgree: "Y"
    })
  });
  const responseText = await response.text();
  if (!response.ok) throw new Error(`KOSHA law search failed: ${response.status ?? "unknown"}`);
  return parseChemIdFromSearchHtml(responseText, casNo);
}

async function fetchLawDetail(detailUrl: string, chemId: string, casNo: string, fetcher: Fetcher) {
  const response = await fetchWithTimeout(detailUrl, fetcher, "KOSHA law detail", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded; charset=UTF-8" },
    body: new URLSearchParams({ chem_id: chemId, cas_no: casNo })
  });
  const responseText = await response.text();
  if (!response.ok) throw new Error(`KOSHA law detail failed: ${response.status ?? "unknown"}`);
  return JSON.parse(responseText) as unknown;
}

function officialApiTimeoutMs() {
  const timeoutMs = Number(process.env.OFFICIAL_API_TIMEOUT_MS || 8_000);
  return Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 8_000;
}

async function fetchWithTimeout(url: string, fetcher: Fetcher, label: string, init: Exclude<Parameters<Fetcher>[1], undefined>) {
  const controller = new AbortController();
  const timeoutMs = officialApiTimeoutMs();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      fetcher(url, { ...init, signal: controller.signal }),
      new Promise<Awaited<ReturnType<Fetcher>>>((_, reject) => {
        timeout = setTimeout(() => {
          controller.abort();
          reject(new Error(`${label} timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      })
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function parseChemIdFromSearchHtml(html: string, casNo: string) {
  const rows = Array.from(html.matchAll(/<tr[\s\S]*?<\/tr>/gi)).map((match) => match[0]);
  for (const row of rows) {
    if (!containsExactCasNo(row, casNo)) continue;
    const detailMatch = row.match(/getDetail\('law','([^']*)','([^']*)'\)/);
    if (detailMatch) return detailMatch[1];
  }

  const fallbackMatch = html.match(/getDetail\('law','([^']*)','([^']*)'\)/);
  return fallbackMatch && containsExactCasNo(html, casNo) ? fallbackMatch[1] : "";
}

function containsExactCasNo(html: string, casNo: string) {
  const text = decodeHtmlText(html);
  const escapedCasNo = casNo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^0-9-])${escapedCasNo}([^0-9-]|$)`).test(text);
}

function decodeHtmlText(html: string) {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&amp;/gi, "&");
}

function parseKoshaLawPayload(casNo: string, responseText: string, sourceUrl: string): OfficialChemicalMatch[] {
  const payload = tryParseJson(responseText);
  if (!isRecord(payload)) return [];
  const detail = payload.detail;
  if (!isRecord(detail)) return [];

  const matches: OfficialChemicalMatch[] = [];
  const chemId = String(payload.chemId ?? "");
  if (chemId) {
    matches.push({
      casNo,
      category: "officialMsdsLawLookup",
      sourceName: "KOSHA 물질규제정보",
      sourceUrl,
      evidenceText: `KOSHA 물질규제정보 / chem_id ${chemId}`
    });
  }

  for (const item of normalizeDetailRows(detail.resultLawDetail)) {
    const category = mapKoshaLawItemDetail(String(item.ITEM_DETAIL ?? ""));
    if (!category) continue;
    matches.push({
      casNo,
      category,
      sourceName: "KOSHA 물질규제정보",
      sourceUrl,
      evidenceText: summarizeLawItem(item)
    });
  }

  if (countValue(detail.resultLawDetail2, "H0202PERMIT_CNT") > 0) {
    matches.push(lawMatch(casNo, "exposureLimit", sourceUrl, "노출기준설정물질"));
  }
  if (countValue(detail.resultLawDetail2, "PERMIT_CNT") > 0) {
    matches.push(lawMatch(casNo, "permissibleLimit", sourceUrl, "허용기준 이하 유지 대상 유해인자"));
  }
  if (countValue(detail.resultLawDetail3, "CNT") > 0) {
    matches.push(lawMatch(casNo, "existingChemical", sourceUrl, "기존화학물질"));
  }
  if (countValue(detail.resultLawDetail4, "CNT") > 0) {
    matches.push(lawMatch(casNo, "psm", sourceUrl, "공정안전보고서(PSM) 제출 대상 유해·위험물질"));
  }

  matches.push(...mapNewRegulationFlags(casNo, detail.resultLawDetail5, sourceUrl));
  return dedupeMatches(matches);
}

function lawMatch(casNo: string, category: string, sourceUrl: string, evidenceText: string): OfficialChemicalMatch {
  return {
    casNo,
    category,
    sourceName: "KOSHA 물질규제정보",
    sourceUrl,
    evidenceText
  };
}

function normalizeDetailRows(value: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(value)) return value.filter(isRecord);
  if (isRecord(value)) return [value];
  return [];
}

function mapKoshaLawItemDetail(itemDetail: string) {
  const categoryByItemDetail: Record<string, string> = {
    "10202": "workEnvironmentMeasurement",
    "10204": "controlledHazardous",
    "10206": "permissionRequired",
    "10208": "manufactureProhibited",
    "10210": "specialHealthExam",
    "10214": "specialManagement",
    "10216": "psm",
    "10402": "accidentPreparedness",
    "10404": "permitted",
    "10406": "prohibited",
    "10412": "restricted",
    "10414": "toxic",
    "10416": "toxic",
    "10418": "toxic",
    "10502": "existingChemical",
    "10504": "toxic",
    "10506": "toxic",
    "10508": "toxic",
    "10510": "permitted",
    "10512": "restricted",
    "10514": "prohibited",
    "10516": "priorityControl"
  };
  return categoryByItemDetail[itemDetail] ?? "";
}

function summarizeLawItem(item: Record<string, unknown>) {
  const parts = [
    item.ITEM_DETAIL,
    item.MAX_MIN_DIV,
    item.MAX_VALUE,
    item.MAX_UNIT ? `(${item.MAX_UNIT})` : ""
  ].map((value) => String(value ?? "").trim()).filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : JSON.stringify(item).slice(0, 1000);
}

function mapNewRegulationFlags(casNo: string, value: unknown, sourceUrl: string) {
  if (!isRecord(value)) return [];
  const flags: Array<[string, string, string]> = [
    ["TOXIC", "toxic", "유독물질"],
    ["RESTRICTED", "restricted", "제한물질"],
    ["ACCIDENTS", "accidentPreparedness", "사고대비물질"],
    ["MOE_RESTRI", "prohibited", "환경부 금지물질"],
    ["MOEL_RESTRICTED", "manufactureProhibited", "고용부 금지물질"],
    ["AUTHORIZATION", "permissionRequired", "허가대상물질"],
    ["MANAGED", "controlledHazardous", "관리대상물질"]
  ];
  return flags.flatMap(([flag, category, evidenceText]) => String(value[flag] ?? "") === "1" ? [lawMatch(casNo, category, sourceUrl, evidenceText)] : []);
}

function countValue(value: unknown, key: string) {
  if (!isRecord(value)) return 0;
  const count = Number(value[key] ?? 0);
  return Number.isFinite(count) ? count : 0;
}

function dedupeMatches(matches: OfficialChemicalMatch[]) {
  const seen = new Set<string>();
  return matches.filter((match) => {
    const key = `${match.category}|${match.evidenceText}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function tryParseJson(text: string) {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
