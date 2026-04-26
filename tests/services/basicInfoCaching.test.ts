import Database from "better-sqlite3";
import { describe, expect, it, vi } from "vitest";
import {
  insertDocument,
  listDocumentBasicInfo,
  upsertDocumentBasicInfo,
  upsertGeneratedDocumentBasicInfo
} from "../../server/db/repositories";
import { migrate } from "../../server/db/schema";
import { withBasicInfoTimeout } from "../../server/routes/documents";
import type { BasicInfoField } from "../../shared/types";

describe("basic info AI enrichment caching", () => {
  it("saves generated AI fields without overwriting user-saved edits", () => {
    const db = new Database(":memory:");
    migrate(db);
    insertDocument(db, { documentId: "doc-1", fileName: "sample.pdf", fileHash: "hash", storagePath: "", status: "needs_review" });
    upsertDocumentBasicInfo(db, "doc-1", [
      { key: "supplier", label: "공급사", value: "사용자 공급사", source: "user_saved" },
      { key: "productName", label: "제품명", value: "", source: "manual_required" }
    ]);

    upsertGeneratedDocumentBasicInfo(db, "doc-1", [
      { key: "supplier", label: "공급사", value: "AI 공급사", source: "openai_api" },
      { key: "productName", label: "제품명", value: "AI 제품명", source: "openai_api" }
    ]);

    expect(Object.fromEntries(listDocumentBasicInfo(db, "doc-1").map((field) => [field.key, field]))).toMatchObject({
      supplier: { key: "supplier", label: "공급사", value: "사용자 공급사", source: "user_saved" },
      productName: { key: "productName", label: "제품명", value: "AI 제품명", source: "openai_api" }
    });
  });

  it("runs the completion callback when AI finishes after the timeout fallback", async () => {
    vi.useFakeTimers();
    const localFields: BasicInfoField[] = [
      { key: "productName", label: "제품명", value: "로컬 후보", source: "file_name" }
    ];
    const aiFields: BasicInfoField[] = [
      { key: "productName", label: "제품명", value: "AI 후보", source: "openai_api" }
    ];
    const onCompleted = vi.fn();
    const operation = new Promise<BasicInfoField[]>((resolve) => {
      setTimeout(() => resolve(aiFields), 200);
    });

    const resultPromise = withBasicInfoTimeout(operation, localFields, 100, onCompleted);
    await vi.advanceTimersByTimeAsync(100);
    await expect(resultPromise).resolves.toEqual(localFields);
    expect(onCompleted).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(100);
    expect(onCompleted).toHaveBeenCalledWith(aiFields);
    vi.useRealTimers();
  });
});
