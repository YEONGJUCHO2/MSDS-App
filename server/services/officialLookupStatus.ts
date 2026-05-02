import type Database from "better-sqlite3";
import type { ApiProviderStatus } from "../../shared/types";
import { countChemicalApiCache } from "../db/repositories";
import { isKecoApiConfigured } from "./kecoChemicalApiClient";
import { isOfficialApiConfigured } from "./koshaApiClient";
import { isKoshaLawApiConfigured } from "./koshaLawApiClient";

export function getOfficialLookupStatus(db: Database.Database): ApiProviderStatus[] {
  return [
    {
      provider: "keco",
      label: "한국환경공단 화학물질 정보 조회",
      configured: isKecoApiConfigured(),
      cacheCount: countChemicalApiCache(db, "keco")
    },
    {
      provider: "kosha",
      label: "KOSHA MSDS/물질규제정보 조회",
      configured: isOfficialApiConfigured() || isKoshaLawApiConfigured(),
      cacheCount: countChemicalApiCache(db, "kosha") + countChemicalApiCache(db, "kosha_law")
    }
  ];
}
