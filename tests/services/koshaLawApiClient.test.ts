import Database from "better-sqlite3";
import { afterEach, describe, expect, it, vi } from "vitest";
import { migrate } from "../../server/db/schema";
import { lookupKoshaLawInfo } from "../../server/services/koshaLawApiClient";

describe("KOSHA law regulation API client", () => {
  afterEach(() => {
    delete process.env.KOSHA_LAW_API_BASE_URL;
    delete process.env.OFFICIAL_API_TIMEOUT_MS;
    vi.useRealTimers();
  });

  it("maps the KOSHA material regulation check marks into internal categories", async () => {
    const db = new Database(":memory:");
    migrate(db);
    process.env.KOSHA_LAW_API_BASE_URL = "https://msds.kosha.or.kr/MSDSInfo/kcic";
    const fetcher = vi.fn(async (url: string, _init?: { body?: URLSearchParams }) => {
      if (url.endsWith("/msdssearchLaw.do")) {
        return {
          ok: true,
          text: async () => [
            "<table>",
            "<tr><td><a href=\"javascript:getDetail('law','009999','');\">다른 물질</a></td><td>630-08-9</td></tr>",
            "<tr><td><a href=\"javascript:getDetail('law','001008','');\">일산화탄소</a></td><td>630-08-0</td></tr>",
            "</table>"
          ].join("")
        };
      }
      return {
        ok: true,
        text: async () => JSON.stringify({
          resultLawDetail2: { H0202PERMIT_CNT: 1, PERMIT_CNT: 1 },
          resultLawDetail3: { CNT: 1 },
          resultLawDetail4: { CNT: 0 },
          resultLawDetail5: null,
          resultLawDetail: [
            { ITEM_DETAIL: "10202", MAX_MIN_DIV: "작업환경측정대상물질", MAX_VALUE: "6개월", MAX_UNIT: null },
            { ITEM_DETAIL: "10204", MAX_MIN_DIV: "관리대상유해물질", MAX_VALUE: null, MAX_UNIT: null },
            { ITEM_DETAIL: "10210", MAX_MIN_DIV: "특수건강진단대상물질", MAX_VALUE: "12개월", MAX_UNIT: null },
            { ITEM_DETAIL: "10402", MAX_MIN_DIV: "사고대비물질", MAX_VALUE: null, MAX_UNIT: null },
            { ITEM_DETAIL: "10414", MAX_MIN_DIV: "인체급성유해성물질", MAX_VALUE: null, MAX_UNIT: null },
            { ITEM_DETAIL: "10416", MAX_MIN_DIV: "인체만성유해성물질", MAX_VALUE: null, MAX_UNIT: null },
            { ITEM_DETAIL: "10502", MAX_MIN_DIV: "기존화학물질", MAX_VALUE: null, MAX_UNIT: null },
            { ITEM_DETAIL: "10504", MAX_MIN_DIV: "인체급성유해성물질", MAX_VALUE: null, MAX_UNIT: null },
            { ITEM_DETAIL: "10506", MAX_MIN_DIV: "인체만성유해성물질", MAX_VALUE: null, MAX_UNIT: null },
            { ITEM_DETAIL: "10516", MAX_MIN_DIV: "중점관리물질", MAX_VALUE: null, MAX_UNIT: null }
          ]
        })
      };
    });

    const result = await lookupKoshaLawInfo(db, "630-08-0", fetcher);

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[0][0]).toBe("https://msds.kosha.or.kr/MSDSInfo/kcic/msdssearchLaw.do");
    expect((fetcher.mock.calls[0][1] as { body?: URLSearchParams } | undefined)?.body?.toString()).toContain("searchKeyword=630-08-0");
    expect(fetcher.mock.calls[1][0]).toBe("https://msds.kosha.or.kr/MSDSInfo/kcic/msdsdetailLaw.do");
    expect((fetcher.mock.calls[1][1] as { body?: URLSearchParams } | undefined)?.body?.toString()).toContain("chem_id=001008");
    expect(result.matches).toEqual(expect.arrayContaining([
      expect.objectContaining({ category: "officialMsdsLawLookup", evidenceText: expect.stringContaining("001008") }),
      expect.objectContaining({ category: "controlledHazardous", evidenceText: expect.stringContaining("관리대상유해물질") }),
      expect.objectContaining({ category: "workEnvironmentMeasurement", evidenceText: expect.stringContaining("6개월") }),
      expect.objectContaining({ category: "specialHealthExam", evidenceText: expect.stringContaining("12개월") }),
      expect.objectContaining({ category: "exposureLimit", evidenceText: expect.stringContaining("노출기준설정물질") }),
      expect.objectContaining({ category: "permissibleLimit", evidenceText: expect.stringContaining("허용기준") }),
      expect.objectContaining({ category: "existingChemical", evidenceText: expect.stringContaining("기존화학물질") }),
      expect.objectContaining({ category: "accidentPreparedness", evidenceText: expect.stringContaining("사고대비물질") }),
      expect.objectContaining({ category: "toxic", evidenceText: expect.stringContaining("인체급성유해성물질") }),
      expect.objectContaining({ category: "priorityControl", evidenceText: expect.stringContaining("중점관리물질") })
    ]));
    expect(result.matches.filter((match) => match.category === "toxic")).toHaveLength(4);
  });

  it("reuses cached KOSHA law JSON after the first lookup", async () => {
    const db = new Database(":memory:");
    migrate(db);
    const fetcher = vi.fn(async (url: string, _init?: { body?: URLSearchParams }) => ({
      ok: true,
      text: async () => url.endsWith("/msdssearchLaw.do")
        ? "<tr><td><a href=\"javascript:getDetail('law','001008','');\">벤젠</a></td><td>71-43-2</td></tr>"
        : JSON.stringify({ resultLawDetail: [{ ITEM_DETAIL: "10204", MAX_MIN_DIV: "관리대상유해물질" }] })
    }));

    const first = await lookupKoshaLawInfo(db, "71-43-2", fetcher);
    const second = await lookupKoshaLawInfo(db, "71-43-2", fetcher);

    expect(first.cacheStatus).toBe("miss");
    expect(second.cacheStatus).toBe("hit");
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(db.prepare("SELECT provider, cas_no AS casNo, status FROM chemical_api_cache").all()).toEqual([
      { provider: "kosha_law", casNo: "71-43-2", status: "ok" }
    ]);
  });

  it("uses only exact CAS rows when choosing the KOSHA law chem_id", async () => {
    const db = new Database(":memory:");
    migrate(db);
    const fetcher = vi.fn(async (url: string, _init?: { body?: URLSearchParams }) => {
      if (url.endsWith("/msdssearchLaw.do")) {
        return {
          ok: true,
          text: async () => [
            "<table>",
            "<tr><td><a href=\"javascript:getDetail('law','wrong','');\">부분일치 물질</a></td><td>1630-08-0</td></tr>",
            "<tr><td><a href=\"javascript:getDetail('law','001176','');\">일산화탄소</a></td><td>630-08-0</td></tr>",
            "</table>"
          ].join("")
        };
      }
      return {
        ok: true,
        text: async () => JSON.stringify({ resultLawDetail: [{ ITEM_DETAIL: "10204", MAX_MIN_DIV: "관리대상유해물질" }] })
      };
    });

    const result = await lookupKoshaLawInfo(db, "630-08-0", fetcher);

    expect((fetcher.mock.calls[1][1] as { body?: URLSearchParams } | undefined)?.body?.get("chem_id")).toBe("001176");
    expect(result.matches).toEqual(expect.arrayContaining([
      expect.objectContaining({ category: "officialMsdsLawLookup", evidenceText: expect.stringContaining("001176") })
    ]));
  });

  it("skips KOSHA law lookup when explicitly disabled", async () => {
    const db = new Database(":memory:");
    migrate(db);
    process.env.KOSHA_LAW_API_BASE_URL = "false";
    const fetcher = vi.fn();

    const result = await lookupKoshaLawInfo(db, "630-08-0", fetcher);

    expect(result).toEqual({ cacheStatus: "not_configured", matches: [] });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("maps KOSHA new chemical regulation flags", async () => {
    const db = new Database(":memory:");
    migrate(db);
    const fetcher = vi.fn(async (url: string) => ({
      ok: true,
      text: async () => url.endsWith("/msdssearchLaw.do")
        ? "<tr><td><a href=\"javascript:getDetail('law','001008','');\">벤젠</a></td><td>71-43-2</td></tr>"
        : JSON.stringify({
          resultLawDetail: [],
          resultLawDetail5: {
            TOXIC: "1",
            RESTRICTED: "1",
            ACCIDENTS: "1",
            MOE_RESTRI: "1",
            MOEL_RESTRICTED: "1",
            AUTHORIZATION: "1",
            MANAGED: "1"
          }
        })
    }));

    const result = await lookupKoshaLawInfo(db, "71-43-2", fetcher);

    expect(result.matches).toEqual(expect.arrayContaining([
      expect.objectContaining({ category: "toxic", evidenceText: "유독물질" }),
      expect.objectContaining({ category: "restricted", evidenceText: "제한물질" }),
      expect.objectContaining({ category: "accidentPreparedness", evidenceText: "사고대비물질" }),
      expect.objectContaining({ category: "prohibited", evidenceText: "환경부 금지물질" }),
      expect.objectContaining({ category: "manufactureProhibited", evidenceText: "고용부 금지물질" }),
      expect.objectContaining({ category: "permissionRequired", evidenceText: "허가대상물질" }),
      expect.objectContaining({ category: "controlledHazardous", evidenceText: "관리대상물질" })
    ]));
  });

  it("caches timeout failures for KOSHA law lookups", async () => {
    vi.useFakeTimers();
    const db = new Database(":memory:");
    migrate(db);
    process.env.OFFICIAL_API_TIMEOUT_MS = "25";
    const fetcher = vi.fn().mockReturnValue(new Promise(() => undefined));

    const lookup = expect(lookupKoshaLawInfo(db, "630-08-0", fetcher)).rejects.toThrow("timed out");
    await vi.advanceTimersByTimeAsync(25);

    await lookup;
    expect(db.prepare("SELECT provider, cas_no AS casNo, status FROM chemical_api_cache").all()).toEqual([
      { provider: "kosha_law", casNo: "630-08-0", status: "timeout" }
    ]);
  });
});
