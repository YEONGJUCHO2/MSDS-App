import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { migrate } from "../../server/db/schema";
import { upsertChemicalApiCache } from "../../server/db/repositories";
import { getOfficialLookupStatus } from "../../server/services/officialLookupStatus";

describe("official lookup status", () => {
  afterEach(() => {
    delete process.env.KOSHA_MSDS_API_URL;
    delete process.env.KOSHA_API_SERVICE_KEY;
    delete process.env.KOSHA_LAW_API_BASE_URL;
  });

  it("counts KOSHA MSDS and KOSHA material regulation caches together", () => {
    const db = new Database(":memory:");
    migrate(db);
    upsertChemicalApiCache(db, {
      provider: "kosha",
      casNo: "12604-53-4",
      requestUrl: "https://msds.kosha.or.kr/openapi/service/msdschem/chemlist",
      responseText: "<response />",
      status: "ok"
    });
    upsertChemicalApiCache(db, {
      provider: "kosha_law",
      casNo: "630-08-0",
      requestUrl: "https://msds.kosha.or.kr/MSDSInfo/kcic/msdsdetailLaw.do",
      responseText: "{}",
      status: "ok"
    });

    const status = getOfficialLookupStatus(db);

    expect(status.find((provider) => provider.provider === "kosha")).toMatchObject({
      label: "KOSHA MSDS/물질규제정보 조회",
      cacheCount: 2
    });
  });

  it("reports KOSHA as unconfigured when both MSDS API and law lookup are disabled", () => {
    const db = new Database(":memory:");
    migrate(db);
    process.env.KOSHA_LAW_API_BASE_URL = "false";

    const status = getOfficialLookupStatus(db);

    expect(status.find((provider) => provider.provider === "kosha")).toMatchObject({
      configured: false,
      cacheCount: 0
    });
  });
});
