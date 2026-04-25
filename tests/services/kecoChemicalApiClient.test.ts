import Database from "better-sqlite3";
import { afterEach, describe, expect, it, vi } from "vitest";
import { migrate } from "../../server/db/schema";
import { lookupKecoChemicalInfo } from "../../server/services/kecoChemicalApiClient";

describe("KECO chemical API client", () => {
  afterEach(() => {
    delete process.env.KECO_CHEM_API_URL;
    delete process.env.KECO_API_SERVICE_KEY;
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
                molFoml: "C3H6O"
              }
            ]
          }
        }
      })
    });

    const first = await lookupKecoChemicalInfo(db, "67-64-1", fetcher);
    const second = await lookupKecoChemicalInfo(db, "67-64-1", fetcher);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(first.matches[0]).toMatchObject({
      casNo: "67-64-1",
      category: "chemicalInfoLookup",
      sourceName: "한국환경공단 화학물질 정보 조회 서비스"
    });
    expect(second.cacheStatus).toBe("hit");
    expect(db.prepare("SELECT provider, cas_no AS casNo, status FROM chemical_api_cache").all()).toEqual([
      { provider: "keco", casNo: "67-64-1", status: "ok" }
    ]);
  });
});
