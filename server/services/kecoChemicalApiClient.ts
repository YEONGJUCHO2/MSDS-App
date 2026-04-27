import type Database from "better-sqlite3";
import { getChemicalApiCache, upsertChemicalApiCache } from "../db/repositories";
import type { OfficialChemicalMatch } from "./koshaApiClient";

type Fetcher = (url: string, init?: { signal?: AbortSignal }) => Promise<{ ok: boolean; text(): Promise<string>; status?: number }>;

export async function lookupKecoChemicalInfo(db: Database.Database, casNo: string, fetcher: Fetcher = fetch, options: { forceRefresh?: boolean } = {}) {
  const cached = getChemicalApiCache(db, "keco", casNo);
  if (!options.forceRefresh && cached?.status === "ok" && new Date(cached.expiresAt).getTime() > Date.now() && isSuccessfulKecoResponse(cached.responseText)) {
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
  let response: Awaited<ReturnType<Fetcher>>;
  try {
    response = await fetchWithTimeout(url.toString(), fetcher, "KECO chemical API");
  } catch (error) {
    upsertChemicalApiCache(db, {
      provider: "keco",
      casNo,
      requestUrl: redactServiceKey(url.toString()),
      responseText: error instanceof Error ? error.message : "lookup failed",
      status: error instanceof Error && error.message.includes("timed out") ? "timeout" : "network_error",
      ttlDays: 1
    });
    throw error;
  }
  const responseText = await response.text();
  if (!response.ok) {
    upsertChemicalApiCache(db, {
      provider: "keco",
      casNo,
      requestUrl: redactServiceKey(url.toString()),
      responseText,
      status: `http_${response.status ?? "error"}`,
      ttlDays: 1
    });
    throw new Error(`KECO chemical API lookup failed: ${response.status ?? "unknown"}`);
  }

  const resultCode = readKecoResultCode(responseText);
  if (resultCode && resultCode !== "200" && resultCode !== "00") {
    upsertChemicalApiCache(db, {
      provider: "keco",
      casNo,
      requestUrl: redactServiceKey(url.toString()),
      responseText,
      status: `api_${resultCode}`,
      ttlDays: 1
    });
    return { cacheStatus: "miss" as const, matches: [] as OfficialChemicalMatch[] };
  }

  upsertChemicalApiCache(db, {
    provider: "keco",
    casNo,
    requestUrl: redactServiceKey(url.toString()),
    responseText,
    status: "ok"
  });

  return {
    cacheStatus: "miss" as const,
    matches: parseKecoResponse(casNo, responseText, redactServiceKey(url.toString()))
  };
}

function officialApiTimeoutMs() {
  const timeoutMs = Number(process.env.OFFICIAL_API_TIMEOUT_MS || 8_000);
  return Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 8_000;
}

async function fetchWithTimeout(url: string, fetcher: Fetcher, label: string) {
  const controller = new AbortController();
  const timeoutMs = officialApiTimeoutMs();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      fetcher(url, { signal: controller.signal }),
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

export function isKecoApiConfigured() {
  return Boolean(process.env.KECO_CHEM_API_URL && process.env.KECO_API_SERVICE_KEY);
}

function buildKecoUrl(endpoint: string, serviceKey: string, casNo: string) {
  const url = new URL(normalizeKecoEndpoint(endpoint));
  url.searchParams.set("serviceKey", serviceKey);
  url.searchParams.set("searchGubun", "2");
  url.searchParams.set("searchNm", casNo);
  url.searchParams.set("numOfRows", "10");
  url.searchParams.set("pageNo", "1");
  url.searchParams.set("returnType", "JSON");
  return url;
}

function normalizeKecoEndpoint(endpoint: string) {
  const normalized = endpoint.replace(/\/$/, "");
  return normalized.endsWith("/chemSbstnList") ? normalized : `${normalized}/chemSbstnList`;
}

function redactServiceKey(sourceUrl: string) {
  const url = new URL(sourceUrl);
  if (url.searchParams.has("serviceKey")) {
    url.searchParams.set("serviceKey", "REDACTED");
  }
  return url.toString();
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

  return items.flatMap((item) => {
    const parsedCasNo = String(item.casNo ?? item.cas_no ?? casNo);
    const baseMatch: OfficialChemicalMatch = {
      casNo: parsedCasNo,
      category: "chemicalInfoLookup",
      sourceName: "한국환경공단 화학물질 정보 조회 서비스",
      sourceUrl,
      evidenceText: summarizeItem(item)
    };
    const classificationMatches = normalizeTypeList(item.typeList).flatMap((classification) => {
      const category = mapKecoClassificationToInternalCategory(String(classification.sbstnClsfTypeNm ?? ""));
      if (!category) return [];
      return [{
        casNo: parsedCasNo,
        category,
        sourceName: "한국환경공단 화학물질 정보 조회 서비스",
        sourceUrl,
        evidenceText: summarizeClassification(classification)
      }];
    });

    return [baseMatch, ...classificationMatches];
  });
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
    valueOf(item, ["sbstnNmKor", "chemNmKor", "chemNameKor", "korNm", "chemNmKr", "물질명국문"]),
    valueOf(item, ["sbstnNmEng", "chemNmEng", "chemNameEng", "engNm", "물질명영문"]),
    valueOf(item, ["korexst", "keNo", "ke_no", "KE_NO"]),
    valueOf(item, ["mlcfrm", "molFoml", "molecularFormula", "분자식"]),
    valueOf(item, ["mlcwgt", "molWt", "molecularWeight", "분자량"])
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" / ") : JSON.stringify(item).slice(0, 1000);
}

function normalizeTypeList(value: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(value)) return value.filter(isRecord);
  if (isRecord(value)) return [value];
  return [];
}

function mapKecoClassificationToInternalCategory(classificationName: string) {
  const normalized = classificationName.replace(/\s+/g, "");
  if (!normalized) return "";
  if (normalized.includes("사고대비물질")) return "accidentPreparedness";
  if (normalized.includes("제한물질")) return "restricted";
  if (normalized.includes("금지물질")) return "prohibited";
  if (normalized.includes("허가물질")) return "permitted";
  if (normalized.includes("유독물질") || normalized.includes("인체등유해성물질") || normalized.includes("생태등유해성물질")) return "toxic";
  return "";
}

function summarizeClassification(classification: Record<string, unknown>) {
  return [
    valueOf(classification, ["sbstnClsfTypeNm"]),
    valueOf(classification, ["unqNo"]),
    valueOf(classification, ["contInfo"]),
    valueOf(classification, ["excpInfo"]),
    valueOf(classification, ["ancmntInfo"]),
    valueOf(classification, ["ancmntYmd"])
  ].filter(Boolean).join(" / ");
}

function isSuccessfulKecoResponse(responseText: string) {
  const resultCode = readKecoResultCode(responseText);
  return !resultCode || resultCode === "200" || resultCode === "00";
}

function readKecoResultCode(responseText: string) {
  const parsed = tryParseJson(responseText);
  if (isRecord(parsed)) {
    const header = isRecord(parsed.header) ? parsed.header : isRecord(parsed.response) && isRecord(parsed.response.header) ? parsed.response.header : undefined;
    const code = header?.resultCode;
    return code === undefined || code === null ? "" : String(code);
  }
  return responseText.match(/<resultCode>([\s\S]*?)<\/resultCode>/)?.[1]?.trim() ?? "";
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
