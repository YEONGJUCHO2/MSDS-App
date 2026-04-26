import { describe, expect, it, vi } from "vitest";
import { withBasicInfoTimeout } from "../../server/routes/documents";
import type { BasicInfoField } from "../../shared/types";

describe("basic info timeout", () => {
  it("returns local fields when AI enrichment is slower than the configured timeout", async () => {
    vi.useFakeTimers();
    const fields: BasicInfoField[] = [
      { key: "productName", label: "제품명", value: "로컬 후보", source: "file_name" }
    ];
    const slowAi = new Promise<BasicInfoField[]>(() => undefined);
    const resultPromise = withBasicInfoTimeout(slowAi, fields, 100);

    await vi.advanceTimersByTimeAsync(100);

    await expect(resultPromise).resolves.toEqual(fields);
    vi.useRealTimers();
  });
});
