import type Database from "better-sqlite3";
import { getChemicalApiCache, upsertChemicalApiCache } from "../db/repositories";

export interface OfficialChemicalMatch {
  casNo: string;
  category: string;
  sourceName: string;
  sourceUrl: string;
  evidenceText: string;
}

type Fetcher = (url: string, init?: { signal?: AbortSignal }) => Promise<{ ok: boolean; text(): Promise<string>; status?: number }>;

export async function lookupKoshaChemicalInfo(db: Database.Database, casNo: string, fetcher: Fetcher = fetch, options: { forceRefresh?: boolean } = {}) {
  const cached = getChemicalApiCache(db, "kosha", casNo);
  if (!options.forceRefresh && cached?.status === "ok" && new Date(cached.expiresAt).getTime() > Date.now()) {
    return {
      cacheStatus: "hit" as const,
      matches: parseKoshaResponse(casNo, cached.responseText, cached.requestUrl)
    };
  }

  const endpoint = process.env.KOSHA_MSDS_API_URL;
  const serviceKey = process.env.KOSHA_API_SERVICE_KEY;
  if (!endpoint || !serviceKey) {
    return { cacheStatus: "not_configured" as const, matches: [] as OfficialChemicalMatch[] };
  }

  const url = buildKoshaUrl(endpoint, serviceKey, casNo);
  let response: Awaited<ReturnType<Fetcher>>;
  try {
    response = await fetchWithTimeout(url.toString(), fetcher, "KOSHA API");
  } catch (error) {
    upsertChemicalApiCache(db, {
      provider: "kosha",
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
      provider: "kosha",
      casNo,
      requestUrl: redactServiceKey(url.toString()),
      responseText,
      status: `http_${response.status ?? "error"}`,
      ttlDays: 1
    });
    throw new Error(`KOSHA API lookup failed: ${response.status ?? "unknown"}`);
  }

  upsertChemicalApiCache(db, {
    provider: "kosha",
    casNo,
    requestUrl: redactServiceKey(url.toString()),
    responseText,
    status: "ok"
  });

  return {
    cacheStatus: "miss" as const,
    matches: parseKoshaResponse(casNo, responseText, redactServiceKey(url.toString()))
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

export function isOfficialApiConfigured() {
  return Boolean(process.env.KOSHA_MSDS_API_URL && process.env.KOSHA_API_SERVICE_KEY);
}

function buildKoshaUrl(endpoint: string, serviceKey: string, casNo: string) {
  const url = new URL(normalizeKoshaEndpoint(endpoint));
  url.searchParams.set("serviceKey", serviceKey);
  url.searchParams.set("searchCnd", "1");
  url.searchParams.set("searchWrd", casNo);
  url.searchParams.set("numOfRows", "10");
  url.searchParams.set("pageNo", "1");
  return url;
}

function normalizeKoshaEndpoint(endpoint: string) {
  const trimmed = endpoint.replace(/\/$/, "");
  if (trimmed.includes("apis.data.go.kr/B552468/msdschem")) {
    return "https://msds.kosha.or.kr/openapi/service/msdschem/chemlist";
  }
  return trimmed.endsWith("/chemlist") ? trimmed : `${trimmed}/chemlist`;
}

function redactServiceKey(sourceUrl: string) {
  const url = new URL(sourceUrl);
  if (url.searchParams.has("serviceKey")) {
    url.searchParams.set("serviceKey", "REDACTED");
  }
  return url.toString();
}

function parseKoshaResponse(casNo: string, responseText: string, sourceUrl: string): OfficialChemicalMatch[] {
  const trimmed = responseText.trim();
  if (!trimmed) return [];

  const items = extractXmlItems(trimmed);
  if (items.length === 0) return [];

  return items.flatMap((item) => {
    const parsedCasNo = readXmlValue(item, "casNo") || casNo;
    if (normalizeCasNo(parsedCasNo) !== normalizeCasNo(casNo)) return [];
    const evidenceParts = [
      readXmlValue(item, "chemNameKor"),
      parsedCasNo,
      readXmlValue(item, "keNo"),
      readXmlValue(item, "lastDate")
    ].filter(Boolean);

    return {
      casNo: parsedCasNo,
      category: "officialMsdsLookup",
      sourceName: "KOSHA MSDS Open API",
      sourceUrl,
      evidenceText: evidenceParts.length > 0 ? evidenceParts.join(" / ") : item.slice(0, 1000)
    };
  });
}

function normalizeCasNo(value: string) {
  return value.replace(/\s+/g, "").toLowerCase();
}

function extractXmlItems(text: string) {
  return Array.from(text.matchAll(/<item>([\s\S]*?)<\/item>/g)).map((match) => match[1]);
}

function readXmlValue(item: string, tagName: string) {
  const escapedTagName = tagName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = item.match(new RegExp(`<${escapedTagName}>([\\s\\S]*?)<\\/${escapedTagName}>`));
  return match ? decodeXmlEntities(match[1].trim()) : "";
}

function decodeXmlEntities(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}
