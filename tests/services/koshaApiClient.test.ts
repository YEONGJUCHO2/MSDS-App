import Database from "better-sqlite3";
import { afterEach, describe, expect, it, vi } from "vitest";
import { migrate } from "../../server/db/schema";
import { lookupKoshaChemicalInfo } from "../../server/services/koshaApiClient";

describe("KOSHA MSDS API client", () => {
  afterEach(() => {
    delete process.env.KOSHA_MSDS_API_URL;
    delete process.env.KOSHA_API_SERVICE_KEY;
    delete process.env.OFFICIAL_API_TIMEOUT_MS;
    vi.useRealTimers();
  });

  it("normalizes the public data.go.kr endpoint, parses XML, and reuses SQLite cache", async () => {
    const db = new Database(":memory:");
    migrate(db);
    process.env.KOSHA_MSDS_API_URL = "https://apis.data.go.kr/B552468/msdschem";
    process.env.KOSHA_API_SERVICE_KEY = "service-key";
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => [
        '<?xml version="1.0" encoding="UTF-8"?>',
        "<response>",
        "<header><resultCode>00</resultCode><resultMsg>NORMAL SERVICE.</resultMsg></header>",
        "<body><items><item>",
        "<casNo>12604-53-4</casNo>",
        "<chemId>003180</chemId>",
        "<chemNameKor>페로망가니즈(페로망간)</chemNameKor>",
        "<keNo>KE-13738</keNo>",
        "<lastDate>2024-11-01T00:00:00+09:00</lastDate>",
        "</item></items></body>",
        "</response>"
      ].join("")
    });

    const first = await lookupKoshaChemicalInfo(db, "12604-53-4", fetcher);
    const second = await lookupKoshaChemicalInfo(db, "12604-53-4", fetcher);

    expect(fetcher).toHaveBeenCalledTimes(1);
    const requestedUrl = new URL(fetcher.mock.calls[0][0]);
    expect(requestedUrl.origin).toBe("https://msds.kosha.or.kr");
    expect(requestedUrl.pathname).toBe("/openapi/service/msdschem/chemlist");
    expect(requestedUrl.searchParams.get("searchCnd")).toBe("1");
    expect(requestedUrl.searchParams.get("searchWrd")).toBe("12604-53-4");
    expect(first.matches[0]).toMatchObject({
      casNo: "12604-53-4",
      category: "officialMsdsLookup",
      sourceName: "KOSHA MSDS Open API",
      sourceUrl: expect.stringContaining("serviceKey=REDACTED"),
      evidenceText: "페로망가니즈(페로망간) / 12604-53-4 / KE-13738 / 2024-11-01T00:00:00+09:00"
    });
    expect(second.cacheStatus).toBe("hit");
    expect(db.prepare("SELECT provider, cas_no AS casNo, status, request_url AS requestUrl FROM chemical_api_cache").all()).toEqual([
      { provider: "kosha", casNo: "12604-53-4", status: "ok", requestUrl: expect.stringContaining("serviceKey=REDACTED") }
    ]);
  });

  it("keeps only exact CAS matches from KOSHA partial-search responses", async () => {
    const db = new Database(":memory:");
    migrate(db);
    process.env.KOSHA_MSDS_API_URL = "https://apis.data.go.kr/B552468/msdschem";
    process.env.KOSHA_API_SERVICE_KEY = "service-key";
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => [
        '<?xml version="1.0" encoding="UTF-8"?>',
        "<response><body><items>",
        "<item><casNo>96-29-7</casNo><chemNameKor>2-부타논 옥심</chemNameKor><keNo>KE-03881</keNo></item>",
        "<item><casNo>696-29-7</casNo><chemNameKor>Isopropylcyclohexane</chemNameKor><keNo>KE-21685</keNo></item>",
        "</items></body></response>"
      ].join("")
    });

    const result = await lookupKoshaChemicalInfo(db, "96-29-7", fetcher);

    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]).toMatchObject({
      casNo: "96-29-7",
      evidenceText: expect.not.stringContaining("696-29-7")
    });
  });

  it("times out slow official API requests and caches the timeout status", async () => {
    vi.useFakeTimers();
    const db = new Database(":memory:");
    migrate(db);
    process.env.KOSHA_MSDS_API_URL = "https://apis.data.go.kr/B552468/msdschem";
    process.env.KOSHA_API_SERVICE_KEY = "service-key";
    process.env.OFFICIAL_API_TIMEOUT_MS = "25";
    const fetcher = vi.fn().mockReturnValue(new Promise(() => undefined));

    const lookup = expect(lookupKoshaChemicalInfo(db, "12604-53-4", fetcher)).rejects.toThrow("timed out");
    await vi.advanceTimersByTimeAsync(25);

    await lookup;
    expect(db.prepare("SELECT provider, cas_no AS casNo, status FROM chemical_api_cache").all()).toEqual([
      { provider: "kosha", casNo: "12604-53-4", status: "timeout" }
    ]);
  });
});
