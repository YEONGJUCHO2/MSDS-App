import Database from "better-sqlite3";
import { afterEach, describe, expect, it, vi } from "vitest";
import { migrate } from "../../server/db/schema";
import { upsertChemicalApiCache } from "../../server/db/repositories";
import { lookupKecoChemicalInfo } from "../../server/services/kecoChemicalApiClient";

describe("KECO chemical API client", () => {
  afterEach(() => {
    delete process.env.KECO_CHEM_API_URL;
    delete process.env.KECO_API_SERVICE_KEY;
    delete process.env.OFFICIAL_API_TIMEOUT_MS;
    vi.useRealTimers();
  });

  it("fetches by CAS No. once and reuses SQLite cache on the next lookup", async () => {
    const db = new Database(":memory:");
    migrate(db);
    process.env.KECO_CHEM_API_URL = "https://example.test/keco";
    process.env.KECO_API_SERVICE_KEY = "service-key";
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({
        response: {
          body: {
            items: [
              {
                casNo: "67-64-1",
                chemNmKor: "아세톤",
                chemNmEng: "Acetone",
                keNo: "KE-29367",
                molFoml: "C3H6O",
                typeList: [
                  {
                    sbstnClsfTypeNm: "인체등유해성물질",
                    unqNo: "2023-1-1127",
                    contInfo: "인체만성유해성 : 0.1%",
                    ancmntInfo: "화학물질안전원고시 제2025-19호"
                  },
                  {
                    sbstnClsfTypeNm: "제한물질",
                    unqNo: "06-5-8",
                    contInfo: "",
                    ancmntInfo: "환경부고시"
                  }
                ]
              }
            ]
          }
        }
      })
    });

    const first = await lookupKecoChemicalInfo(db, "67-64-1", fetcher);
    const second = await lookupKecoChemicalInfo(db, "67-64-1", fetcher);

    expect(fetcher).toHaveBeenCalledTimes(1);
    const requestedUrl = new URL(fetcher.mock.calls[0][0]);
    expect(requestedUrl.pathname).toBe("/keco/chemSbstnList");
    expect(requestedUrl.searchParams.get("searchGubun")).toBe("2");
    expect(requestedUrl.searchParams.get("searchNm")).toBe("67-64-1");
    expect(requestedUrl.searchParams.get("returnType")).toBe("JSON");
    expect(first.matches).toEqual(expect.arrayContaining([
      expect.objectContaining({
        casNo: "67-64-1",
        category: "chemicalInfoLookup",
        sourceName: "한국환경공단 화학물질 정보 조회 서비스",
        sourceUrl: expect.stringContaining("serviceKey=REDACTED")
      }),
      expect.objectContaining({
        casNo: "67-64-1",
        category: "toxic",
        evidenceText: expect.stringContaining("인체등유해성물질")
      }),
      expect.objectContaining({
        casNo: "67-64-1",
        category: "restricted",
        evidenceText: expect.stringContaining("제한물질")
      })
    ]));
    expect(second.cacheStatus).toBe("hit");
    expect(db.prepare("SELECT provider, cas_no AS casNo, status, request_url AS requestUrl FROM chemical_api_cache").all()).toEqual([
      { provider: "keco", casNo: "67-64-1", status: "ok", requestUrl: expect.stringContaining("serviceKey=REDACTED") }
    ]);
  });

  it("does not reuse cached failed responses as successful matches", async () => {
    const db = new Database(":memory:");
    migrate(db);
    process.env.KECO_CHEM_API_URL = "https://example.test/keco";
    process.env.KECO_API_SERVICE_KEY = "service-key";
    upsertChemicalApiCache(db, {
      provider: "keco",
      casNo: "67-64-1",
      requestUrl: "https://example.test/keco/chemSbstnList",
      responseText: "Not found",
      status: "http_404"
    });
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ body: { items: [] } })
    });

    const result = await lookupKecoChemicalInfo(db, "67-64-1", fetcher);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result.cacheStatus).toBe("miss");
    expect(result.matches).toEqual([]);
  });

  it("refetches old cached KECO parameter errors instead of treating them as usable cache hits", async () => {
    const db = new Database(":memory:");
    migrate(db);
    process.env.KECO_CHEM_API_URL = "https://example.test/keco";
    process.env.KECO_API_SERVICE_KEY = "service-key";
    upsertChemicalApiCache(db, {
      provider: "keco",
      casNo: "67-64-1",
      requestUrl: "https://example.test/keco/chemSbstnList",
      responseText: JSON.stringify({ header: { resultCode: "91", resultMsg: "잘못된 파라미터 요청입니다." }, body: null }),
      status: "ok"
    });
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({
        header: { resultCode: "200", resultMsg: "NORMAL SERVICE." },
        body: { items: [{ casNo: "67-64-1", sbstnNmKor: "아세톤", typeList: [] }] }
      })
    });

    const result = await lookupKecoChemicalInfo(db, "67-64-1", fetcher);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result.cacheStatus).toBe("miss");
    expect(result.matches).toHaveLength(1);
  });

  it("times out slow official API requests and caches the timeout status", async () => {
    vi.useFakeTimers();
    const db = new Database(":memory:");
    migrate(db);
    process.env.KECO_CHEM_API_URL = "https://example.test/keco";
    process.env.KECO_API_SERVICE_KEY = "service-key";
    process.env.OFFICIAL_API_TIMEOUT_MS = "25";
    const fetcher = vi.fn().mockReturnValue(new Promise(() => undefined));

    const lookup = expect(lookupKecoChemicalInfo(db, "67-64-1", fetcher)).rejects.toThrow("timed out");
    await vi.advanceTimersByTimeAsync(25);

    await lookup;
    expect(db.prepare("SELECT provider, cas_no AS casNo, status FROM chemical_api_cache").all()).toEqual([
      { provider: "keco", casNo: "67-64-1", status: "timeout" }
    ]);
  });
});
