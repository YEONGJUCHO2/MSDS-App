import type Database from "better-sqlite3";
import { nanoid } from "nanoid";
import type { AiReviewStatus, BasicInfoField, DocumentSummary, RegulatoryMatch, RegulatoryMatchStatus, ReviewStatus, Section3Row } from "../../shared/types";
import { normalizeUploadedFileName } from "../services/fileName";

type ComponentCandidateInput = Pick<
  Section3Row,
  "casNoCandidate" | "chemicalNameCandidate" | "contentMinCandidate" | "contentMaxCandidate" | "contentSingleCandidate"
>;

export function insertDocument(
  db: Database.Database,
  input: { documentId?: string; fileName: string; fileHash: string; storagePath: string; status: string; textContent?: string; pageCount?: number }
) {
  const documentId = input.documentId ?? nanoid();
  db.prepare(`
    INSERT INTO documents (document_id, file_name, file_hash, storage_path, status, uploaded_at, text_content, page_count)
    VALUES (@documentId, @fileName, @fileHash, @storagePath, @status, @uploadedAt, @textContent, @pageCount)
  `).run({
    documentId,
    fileName: input.fileName,
    fileHash: input.fileHash,
    storagePath: input.storagePath,
    status: input.status,
    uploadedAt: new Date().toISOString(),
    textContent: input.textContent ?? "",
    pageCount: input.pageCount ?? 0
  });
  return documentId;
}

export function upsertDocumentText(db: Database.Database, documentId: string, textContent: string, pageCount: number, status: string) {
  db.prepare("UPDATE documents SET text_content = @textContent, page_count = @pageCount, status = @status WHERE document_id = @documentId").run({
    documentId,
    textContent,
    pageCount,
    status
  });
}

export function insertComponentRows(db: Database.Database, documentId: string, rows: Section3Row[]) {
  const insert = db.prepare(`
    INSERT INTO components (
      row_id, document_id, row_index, raw_row_text, cas_no_candidate, chemical_name_candidate,
      content_min_candidate, content_max_candidate, content_single_candidate, content_text,
      confidence, evidence_location, review_status, ai_review_status, ai_review_note, regulatory_match_status
    ) VALUES (
      @rowId, @documentId, @rowIndex, @rawRowText, @casNoCandidate, @chemicalNameCandidate,
      @contentMinCandidate, @contentMaxCandidate, @contentSingleCandidate, @contentText,
      @confidence, @evidenceLocation, @reviewStatus, @aiReviewStatus, @aiReviewNote, @regulatoryMatchStatus
    )
  `);

  const insertQueue = db.prepare(`
    INSERT INTO review_queue (queue_id, document_id, entity_id, field_type, label, candidate_value, evidence, review_status, created_at)
    VALUES (@queueId, @documentId, @entityId, 'component', @label, @candidateValue, @evidence, @reviewStatus, @createdAt)
  `);

  const transaction = db.transaction(() => {
    for (const row of rows) {
      const rowId = row.rowId ?? nanoid();
      insert.run({
        ...row,
        rowId,
        documentId,
        aiReviewStatus: row.aiReviewStatus ?? "not_reviewed",
        aiReviewNote: row.aiReviewNote ?? "",
        regulatoryMatchStatus: row.regulatoryMatchStatus ?? "not_checked"
      });
      if (needsHumanAttention(row)) {
        insertQueue.run({
          queueId: nanoid(),
          documentId,
          entityId: rowId,
          label: `${row.chemicalNameCandidate || "성분"} / ${row.casNoCandidate || "CAS 확인 필요"}`,
          candidateValue: row.contentText,
          evidence: `${row.evidenceLocation}: ${row.rawRowText}`,
          reviewStatus: row.reviewStatus,
          createdAt: new Date().toISOString()
        });
      }
    }
  });

  transaction();
}

export function insertManualComponentRow(db: Database.Database, documentId: string, input: ComponentCandidateInput) {
  const rowId = nanoid();
  const rowIndex = nextComponentRowIndex(db, documentId);
  const contentText = formatContentText(input);
  const rawRowText = [input.chemicalNameCandidate, input.casNoCandidate, contentText].filter(Boolean).join(" ");
  insertComponentRows(db, documentId, [{
    rowId,
    rowIndex,
    rawRowText,
    ...input,
    contentText,
    confidence: 1,
    evidenceLocation: "수동 추가",
    reviewStatus: "edited",
    aiReviewStatus: "ai_needs_attention",
    aiReviewNote: "사용자가 직접 추가한 성분입니다.",
    regulatoryMatchStatus: "not_checked"
  }]);
  return rowId;
}

export function updateComponentCandidate(db: Database.Database, rowId: string, input: ComponentCandidateInput) {
  const contentText = formatContentText(input);
  const rawRowText = [input.chemicalNameCandidate, input.casNoCandidate, contentText].filter(Boolean).join(" ");
  const current = db.prepare(`
    SELECT
      cas_no_candidate AS casNoCandidate,
      chemical_name_candidate AS chemicalNameCandidate,
      content_min_candidate AS contentMinCandidate,
      content_max_candidate AS contentMaxCandidate,
      content_single_candidate AS contentSingleCandidate
    FROM components
    WHERE row_id = ?
  `).get(rowId) as ComponentCandidateInput | undefined;
  const changed = !current || !componentCandidateEquals(current, input);
  const transaction = db.transaction(() => {
    db.prepare(`
      UPDATE components
      SET
        raw_row_text = @rawRowText,
        cas_no_candidate = @casNoCandidate,
        chemical_name_candidate = @chemicalNameCandidate,
        content_min_candidate = @contentMinCandidate,
        content_max_candidate = @contentMaxCandidate,
        content_single_candidate = @contentSingleCandidate,
        content_text = @contentText,
        review_status = 'edited',
        ai_review_status = 'ai_needs_attention',
        ai_review_note = '사용자가 수정한 성분입니다.',
        regulatory_match_status = CASE WHEN @changed THEN 'not_checked' ELSE regulatory_match_status END
      WHERE row_id = @rowId
    `).run({ rowId, rawRowText, contentText, changed: changed ? 1 : 0, ...input });
    if (changed) {
      db.prepare("DELETE FROM regulatory_matches WHERE row_id = ?").run(rowId);
      pruneOrphanWatchlist(db);
    }
    db.prepare(`
      UPDATE review_queue
      SET
        label = @label,
        candidate_value = @contentText,
        evidence = @evidence,
        review_status = 'edited'
      WHERE entity_id = @rowId
    `).run({
      rowId,
      label: `${input.chemicalNameCandidate || "성분"} / ${input.casNoCandidate || "CAS 확인 필요"}`,
      contentText,
      evidence: `사용자 수정: ${rawRowText}`
    });
  });
  transaction();
}

export function removeComponentRow(db: Database.Database, rowId: string) {
  const transaction = db.transaction(() => {
    db.prepare("DELETE FROM regulatory_matches WHERE row_id = ?").run(rowId);
    db.prepare("DELETE FROM review_queue WHERE entity_id = ?").run(rowId);
    db.prepare("DELETE FROM components WHERE row_id = ?").run(rowId);
    pruneOrphanWatchlist(db);
  });
  transaction();
}

export function deleteDocumentRecord(db: Database.Database, documentId: string) {
  const document = db.prepare("SELECT storage_path AS storagePath FROM documents WHERE document_id = ?").get(documentId) as { storagePath: string } | undefined;
  if (!document) return undefined;

  const transaction = db.transaction(() => {
    db.prepare("DELETE FROM products WHERE document_id = ?").run(documentId);
    db.prepare("DELETE FROM document_basic_info WHERE document_id = ?").run(documentId);
    db.prepare("DELETE FROM regulatory_matches WHERE document_id = ?").run(documentId);
    db.prepare("DELETE FROM review_queue WHERE document_id = ?").run(documentId);
    db.prepare("DELETE FROM components WHERE document_id = ?").run(documentId);
    db.prepare("DELETE FROM documents WHERE document_id = ?").run(documentId);
    pruneOrphanWatchlist(db);
  });
  transaction();

  return document;
}

export function deleteProductRecord(db: Database.Database, productId: string) {
  const result = db.prepare("DELETE FROM products WHERE product_id = ?").run(productId);
  return result.changes > 0;
}

export function pruneOrphanWatchlist(db: Database.Database) {
  db.prepare(`
    DELETE FROM watchlist
    WHERE NOT EXISTS (
      SELECT 1
      FROM components
      WHERE components.cas_no_candidate = watchlist.cas_no
    )
    AND NOT EXISTS (
      SELECT 1
      FROM regulatory_matches
      WHERE regulatory_matches.cas_no = watchlist.cas_no
    )
  `).run();
}

export function listDocuments(db: Database.Database): DocumentSummary[] {
  const rows = db.prepare(`
    SELECT
      d.document_id AS documentId,
      d.file_name AS fileName,
      d.status AS status,
      d.uploaded_at AS uploadedAt,
      COUNT(DISTINCT c.row_id) AS componentCount,
      COUNT(DISTINCT q.queue_id) AS queueCount
    FROM documents d
    LEFT JOIN components c ON c.document_id = d.document_id
    LEFT JOIN review_queue q ON q.document_id = d.document_id AND q.review_status = 'needs_review'
      AND (
        q.field_type != 'component'
        OR EXISTS (
          SELECT 1 FROM components cq
          WHERE cq.row_id = q.entity_id
            AND (
              cq.cas_no_candidate = ''
              OR cq.chemical_name_candidate = ''
              OR cq.content_text = ''
              OR cq.ai_review_status = 'ai_needs_attention'
              OR cq.regulatory_match_status IN ('api_key_required', 'no_match')
            )
        )
      )
    GROUP BY d.document_id
    ORDER BY d.uploaded_at DESC
  `).all() as DocumentSummary[];

  return rows.map((row) => ({
    ...row,
    fileName: normalizeUploadedFileName(row.fileName)
  }));
}

export function listDocumentBasicInfo(db: Database.Database, documentId: string) {
  return db.prepare(`
    SELECT
      info_key AS key,
      label,
      value,
      source
    FROM document_basic_info
    WHERE document_id = ?
  `).all(documentId) as BasicInfoField[];
}

export function upsertDocumentBasicInfo(db: Database.Database, documentId: string, fields: BasicInfoField[]) {
  const upsert = db.prepare(`
    INSERT INTO document_basic_info (document_id, info_key, label, value, source, updated_at)
    VALUES (@documentId, @key, @label, @value, @source, @updatedAt)
    ON CONFLICT(document_id, info_key) DO UPDATE SET
      label = excluded.label,
      value = excluded.value,
      source = excluded.source,
      updated_at = excluded.updated_at
  `);

  const transaction = db.transaction(() => {
    for (const field of fields) {
      upsert.run({
        documentId,
        key: field.key,
        label: field.label,
        value: field.value.trim(),
        source: field.value.trim() ? "user_saved" : "manual_required",
        updatedAt: new Date().toISOString()
      });
    }
  });
  transaction();
}

export function upsertGeneratedDocumentBasicInfo(db: Database.Database, documentId: string, fields: BasicInfoField[]) {
  const upsert = db.prepare(`
    INSERT INTO document_basic_info (document_id, info_key, label, value, source, updated_at)
    VALUES (@documentId, @key, @label, @value, @source, @updatedAt)
    ON CONFLICT(document_id, info_key) DO UPDATE SET
      label = excluded.label,
      value = excluded.value,
      source = excluded.source,
      updated_at = excluded.updated_at
    WHERE document_basic_info.source != 'user_saved'
  `);

  const transaction = db.transaction(() => {
    for (const field of fields) {
      upsert.run({
        documentId,
        key: field.key,
        label: field.label,
        value: field.value.trim(),
        source: field.value.trim() ? field.source : "manual_required",
        updatedAt: new Date().toISOString()
      });
    }
  });
  transaction();
}

function nextComponentRowIndex(db: Database.Database, documentId: string) {
  const row = db.prepare("SELECT COALESCE(MAX(row_index), -1) + 1 AS nextIndex FROM components WHERE document_id = ?").get(documentId) as { nextIndex: number };
  return row.nextIndex;
}

function formatContentText(input: ComponentCandidateInput) {
  if (input.contentSingleCandidate.trim()) return input.contentSingleCandidate.trim();
  if (input.contentMinCandidate.trim() || input.contentMaxCandidate.trim()) {
    return `${input.contentMinCandidate.trim()}~${input.contentMaxCandidate.trim()}`.replace(/^~/, "").replace(/~$/, "");
  }
  return "";
}

function componentCandidateEquals(a: ComponentCandidateInput, b: ComponentCandidateInput) {
  return a.casNoCandidate === b.casNoCandidate
    && a.chemicalNameCandidate === b.chemicalNameCandidate
    && a.contentMinCandidate === b.contentMinCandidate
    && a.contentMaxCandidate === b.contentMaxCandidate
    && a.contentSingleCandidate === b.contentSingleCandidate;
}

function needsHumanAttention(row: Section3Row) {
  return !row.casNoCandidate
    || !row.chemicalNameCandidate
    || !row.contentText
    || row.aiReviewStatus === "ai_needs_attention"
    || row.regulatoryMatchStatus === "api_key_required"
    || row.regulatoryMatchStatus === "no_match";
}

export function listReviewQueue(db: Database.Database) {
  return db.prepare(`
    SELECT
      queue_id AS queueId,
      document_id AS documentId,
      entity_id AS entityId,
      field_type AS fieldType,
      label,
      candidate_value AS candidateValue,
      evidence,
      review_status AS reviewStatus,
      created_at AS createdAt
    FROM review_queue
    WHERE review_status != 'needs_review'
       OR field_type != 'component'
       OR EXISTS (
         SELECT 1 FROM components cq
         WHERE cq.row_id = review_queue.entity_id
           AND (
             cq.cas_no_candidate = ''
             OR cq.chemical_name_candidate = ''
             OR cq.content_text = ''
             OR cq.ai_review_status = 'ai_needs_attention'
             OR cq.regulatory_match_status IN ('api_key_required', 'no_match')
           )
       )
    ORDER BY created_at DESC
  `).all();
}

export function listComponentRows(db: Database.Database, documentId: string): Section3Row[] {
  const rows = db.prepare(`
    SELECT
      row_id AS rowId,
      row_index AS rowIndex,
      raw_row_text AS rawRowText,
      cas_no_candidate AS casNoCandidate,
      chemical_name_candidate AS chemicalNameCandidate,
      content_min_candidate AS contentMinCandidate,
      content_max_candidate AS contentMaxCandidate,
      content_single_candidate AS contentSingleCandidate,
      content_text AS contentText,
      confidence,
      evidence_location AS evidenceLocation,
      review_status AS reviewStatus,
      ai_review_status AS aiReviewStatus,
      ai_review_note AS aiReviewNote,
      regulatory_match_status AS regulatoryMatchStatus
    FROM components
    WHERE document_id = ?
    ORDER BY row_index ASC
  `).all(documentId) as Section3Row[];

  if (rows.length === 0) return rows;
  const matches = db.prepare(`
    SELECT
      match_id AS matchId,
      row_id AS rowId,
      document_id AS documentId,
      cas_no AS casNo,
      category,
      status,
      source_type AS sourceType,
      source_name AS sourceName,
      source_url AS sourceUrl,
      evidence_text AS evidenceText,
      checked_at AS checkedAt
    FROM regulatory_matches
    WHERE document_id = ?
    ORDER BY source_type ASC, category ASC
  `).all(documentId) as RegulatoryMatch[];
  const matchesByRow = new Map<string, RegulatoryMatch[]>();
  for (const match of matches) {
    matchesByRow.set(match.rowId, [...(matchesByRow.get(match.rowId) ?? []), match]);
  }

  return rows.map((row) => ({
    ...row,
    regulatoryMatches: row.rowId ? matchesByRow.get(row.rowId) ?? [] : []
  }));
}

export function getComponentRow(db: Database.Database, rowId: string) {
  return db.prepare(`
    SELECT
      row_id AS rowId,
      document_id AS documentId,
      cas_no_candidate AS casNoCandidate,
      chemical_name_candidate AS chemicalNameCandidate
    FROM components
    WHERE row_id = ?
  `).get(rowId) as
    | {
        rowId: string;
        documentId: string;
        casNoCandidate: string;
        chemicalNameCandidate: string;
      }
    | undefined;
}

export function updateComponentAiReview(
  db: Database.Database,
  rowId: string,
  input: { aiReviewStatus: AiReviewStatus; aiReviewNote: string }
) {
  db.prepare("UPDATE components SET ai_review_status = @aiReviewStatus, ai_review_note = @aiReviewNote WHERE row_id = @rowId").run({
    rowId,
    ...input
  });
}

export function updateComponentRegulatoryStatus(db: Database.Database, rowId: string, status: RegulatoryMatchStatus) {
  db.prepare("UPDATE components SET regulatory_match_status = ? WHERE row_id = ?").run(status, rowId);
}

export function updateComponentReviewStatus(db: Database.Database, rowId: string, reviewStatus: ReviewStatus) {
  const component = db.prepare(`
    SELECT
      row_id AS rowId,
      document_id AS documentId,
      raw_row_text AS rawRowText,
      content_text AS contentText,
      evidence_location AS evidenceLocation
    FROM components
    WHERE row_id = ?
  `).get(rowId) as
    | {
        rowId: string;
        documentId: string;
        rawRowText: string;
        contentText: string;
        evidenceLocation: string;
      }
    | undefined;

  const transaction = db.transaction(() => {
    db.prepare("UPDATE components SET review_status = ? WHERE row_id = ?").run(reviewStatus, rowId);
    db.prepare("UPDATE review_queue SET review_status = ? WHERE entity_id = ?").run(reviewStatus, rowId);
    if (component) {
      db.prepare(`
        UPDATE review_queue
        SET review_status = @reviewStatus, entity_id = @rowId
        WHERE document_id = @documentId
          AND field_type = 'component'
          AND entity_id = ''
          AND evidence = @evidence
          AND candidate_value = @contentText
      `).run({
        reviewStatus,
        rowId,
        documentId: component.documentId,
        evidence: `${component.evidenceLocation}: ${component.rawRowText}`,
        contentText: component.contentText
      });
    }
  });
  transaction();
}

export function insertRegulatoryMatch(
  db: Database.Database,
  input: Omit<RegulatoryMatch, "matchId" | "checkedAt">
) {
  db.prepare(`
    INSERT INTO regulatory_matches (
      match_id, row_id, document_id, cas_no, category, status, source_type,
      source_name, source_url, evidence_text, checked_at
    ) VALUES (
      @matchId, @rowId, @documentId, @casNo, @category, @status, @sourceType,
      @sourceName, @sourceUrl, @evidenceText, @checkedAt
    )
  `).run({
    matchId: nanoid(),
    checkedAt: new Date().toISOString(),
    ...input
  });
}

export function deleteRegulatoryMatchesForRow(db: Database.Database, rowId: string) {
  db.prepare("DELETE FROM regulatory_matches WHERE row_id = ?").run(rowId);
}

export function upsertWatchlist(db: Database.Database, input: { casNo: string; chemicalName: string; sourceName: string; status: string; checkedAt?: string }) {
  db.prepare(`
    INSERT INTO watchlist (watch_id, cas_no, chemical_name, last_source_name, last_checked_at, status)
    VALUES (@watchId, @casNo, @chemicalName, @sourceName, @checkedAt, @status)
    ON CONFLICT(cas_no) DO UPDATE SET
      chemical_name = excluded.chemical_name,
      last_source_name = excluded.last_source_name,
      last_checked_at = excluded.last_checked_at,
      status = excluded.status
  `).run({
    watchId: nanoid(),
    ...input,
    checkedAt: input.checkedAt ?? new Date().toISOString()
  });
}

export function getChemicalApiCache(db: Database.Database, provider: string, casNo: string) {
  return db.prepare(`
    SELECT
      cache_id AS cacheId,
      provider,
      cas_no AS casNo,
      request_url AS requestUrl,
      response_text AS responseText,
      status,
      fetched_at AS fetchedAt,
      expires_at AS expiresAt
    FROM chemical_api_cache
    WHERE provider = ? AND cas_no = ?
  `).get(provider, casNo) as
    | {
        cacheId: string;
        provider: string;
        casNo: string;
        requestUrl: string;
        responseText: string;
        status: string;
        fetchedAt: string;
        expiresAt: string;
      }
    | undefined;
}

export function upsertChemicalApiCache(
  db: Database.Database,
  input: { provider: string; casNo: string; requestUrl: string; responseText: string; status: string; ttlDays?: number }
) {
  const fetchedAt = new Date();
  const expiresAt = new Date(fetchedAt);
  expiresAt.setDate(expiresAt.getDate() + (input.ttlDays ?? 30));
  db.prepare(`
    INSERT INTO chemical_api_cache (
      cache_id, provider, cas_no, request_url, response_text, status, fetched_at, expires_at
    ) VALUES (
      @cacheId, @provider, @casNo, @requestUrl, @responseText, @status, @fetchedAt, @expiresAt
    )
    ON CONFLICT(provider, cas_no) DO UPDATE SET
      request_url = excluded.request_url,
      response_text = excluded.response_text,
      status = excluded.status,
      fetched_at = excluded.fetched_at,
      expires_at = excluded.expires_at
  `).run({
    cacheId: nanoid(),
    fetchedAt: fetchedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    ...input
  });
}

export function countChemicalApiCache(db: Database.Database, provider: string) {
  const row = db.prepare("SELECT COUNT(*) AS count FROM chemical_api_cache WHERE provider = ?").get(provider) as { count: number };
  return row.count;
}
