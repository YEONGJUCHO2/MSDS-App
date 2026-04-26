import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Supabase cloud MVP schema", () => {
  const sql = readFileSync("supabase/migrations/20260426_cloud_mvp_foundation.sql", "utf8");

  it("creates the upload and review tables used by the first cloud slice", () => {
    for (const tableName of [
      "documents",
      "document_basic_info",
      "components",
      "regulatory_matches",
      "chemical_api_cache",
      "review_queue"
    ]) {
      expect(sql).toContain(`create table if not exists public.${tableName}`);
    }
  });

  it("does not enable public storage access by policy", () => {
    expect(sql).not.toMatch(/for all\s+using\s+\(true\)/i);
  });
});
