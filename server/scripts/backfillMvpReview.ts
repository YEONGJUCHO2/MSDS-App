import "../config/loadEnv";
import { getDb } from "../db/connection";
import { listDocuments, listComponentRows, updateComponentAiReview } from "../db/repositories";
import { reviewComponentRowsWithOptionalCodex } from "../services/aiReviewer";
import { matchAndStoreRegulatoryData } from "../services/regulatoryMatcher";

const db = getDb();
const documents = listDocuments(db);
let reviewed = 0;
let matched = 0;

for (const document of documents) {
  const rows = listComponentRows(db, document.documentId);
  const reviewedRows = await reviewComponentRowsWithOptionalCodex("", rows);
  for (const row of reviewedRows) {
    if (!row.rowId) continue;
    updateComponentAiReview(db, row.rowId, {
      aiReviewStatus: row.aiReviewStatus,
      aiReviewNote: row.aiReviewNote
    });
    reviewed += 1;
  }
  const matchResults = await matchAndStoreRegulatoryData(db, document.documentId, rows);
  matched += matchResults.length;
}

console.log(`Backfilled ${reviewed} AI reviews and ${matched} regulatory lookup rows.`);
