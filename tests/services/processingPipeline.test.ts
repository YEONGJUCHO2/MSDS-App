import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { migrate } from "../../server/db/schema";
import { processExtractedText } from "../../server/services/processingPipeline";

describe("processing pipeline", () => {
  it("creates review queue items from extracted MSDS component rows", async () => {
    const db = new Database(":memory:");
    migrate(db);
    const result = await processExtractedText(db, {
      documentId: "doc-1",
      fileName: "sample.pdf",
      text: "3. 구성성분의 명칭 및 함유량\nAcetone 67-64-1 30~60%\n4. 응급조치 요령",
      pageCount: 1
    });

    expect(result.status).toBe("needs_review");
    expect(result.componentRows).toHaveLength(1);
    expect(db.prepare("SELECT COUNT(*) AS count FROM review_queue").get()).toEqual({ count: 1 });
  });
});
