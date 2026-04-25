import type Database from "better-sqlite3";
import type { ApiProviderStatus } from "../../shared/types";
import { countChemicalApiCache } from "../db/repositories";
import { isKecoApiConfigured } from "./kecoChemicalApiClient";
import { isOfficialApiConfigured } from "./koshaApiClient";

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
      label: "KOSHA MSDS 조회",
      configured: isOfficialApiConfigured(),
      cacheCount: countChemicalApiCache(db, "kosha")
    }
  ];
}
