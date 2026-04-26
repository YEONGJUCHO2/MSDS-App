import crypto from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { Router } from "express";
import multer from "multer";
import { nanoid } from "nanoid";
import { getDb } from "../db/connection";
import {
  deleteDocumentRecord,
  insertDocument,
  insertManualComponentRow,
  listComponentRows,
  listDocumentBasicInfo,
  listDocuments,
  removeComponentRow,
  upsertDocumentBasicInfo,
  updateComponentCandidate,
  updateComponentReviewStatus
} from "../db/repositories";
import { normalizeUploadedFileName } from "../services/fileName";
import { extractDocumentBasicInfo } from "../services/basicInfoExtractor";
import { createCodexAdapter } from "../services/codexAdapter";
import { extractPdfText } from "../services/pdfExtractor";
import { processExtractedText } from "../services/processingPipeline";
import { recheckComponentRegulatoryData } from "../services/regulatoryMatcher";

const upload = multer({ storage: multer.memoryStorage() });
export const documentsRouter = Router();

documentsRouter.get("/", (_req, res) => {
  res.json({ documents: listDocuments(getDb()) });
});

documentsRouter.get("/:documentId/components", (req, res) => {
  res.json({ rows: listComponentRows(getDb(), req.params.documentId) });
});

documentsRouter.delete("/:documentId", async (req, res, next) => {
  try {
    const deleted = deleteDocumentRecord(getDb(), req.params.documentId);
    if (!deleted) {
      res.status(404).json({ error: "document not found" });
      return;
    }
    if (deleted.storagePath) {
      await unlink(deleted.storagePath).catch((error: unknown) => {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      });
    }
    res.json({ documentId: req.params.documentId, documents: listDocuments(getDb()) });
  } catch (error) {
    next(error);
  }
});

documentsRouter.get("/:documentId/basic-info", async (req, res, next) => {
  try {
    const document = getDocumentForBasicInfo(req.params.documentId);

    if (!document) {
      res.status(404).json({ error: "document not found" });
      return;
    }

    res.json(await readDocumentBasicInfo(req.params.documentId));
  } catch (error) {
    next(error);
  }
});

documentsRouter.patch("/:documentId/basic-info", async (req, res, next) => {
  try {
    const document = getDocumentForBasicInfo(req.params.documentId);
    if (!document) {
      res.status(404).json({ error: "document not found" });
      return;
    }
    upsertDocumentBasicInfo(getDb(), req.params.documentId, readBasicInfoFields(req.body));
    res.json(await readDocumentBasicInfo(req.params.documentId));
  } catch (error) {
    next(error);
  }
});

function getDocumentForBasicInfo(documentId: string) {
  return getDb().prepare(`
    SELECT
      document_id AS documentId,
      file_name AS fileName,
      text_content AS textContent
    FROM documents
    WHERE document_id = ?
  `).get(documentId) as { documentId: string; fileName: string; textContent: string } | undefined;
}

async function readDocumentBasicInfo(documentId: string) {
  const db = getDb();
  const document = getDocumentForBasicInfo(documentId);
  if (!document) throw new Error("document not found");
  const product = db.prepare(`
    SELECT GROUP_CONCAT(site_names, ', ') AS siteNames
    FROM products
    WHERE document_id = ?
      AND site_names != ''
  `).get(documentId) as { siteNames: string | null } | undefined;
  const queue = db.prepare(`
    SELECT COUNT(*) AS count
    FROM review_queue
    WHERE document_id = ?
      AND review_status = 'needs_review'
  `).get(documentId) as { count: number };
  const extractedFields = extractDocumentBasicInfo({
    fileName: document.fileName,
    textContent: document.textContent,
    siteNames: product?.siteNames ?? "",
    queueCount: queue.count
  });
  const savedFields = listDocumentBasicInfo(db, documentId);
  const savedByKey = new Map(savedFields.map((field) => [field.key, field]));
  const fields = savedFields.length > 0
    ? extractedFields.map((field) => savedByKey.get(field.key) ?? field)
    : await enrichBasicInfoWithCodex(document.textContent, extractedFields);

  return {
    documentId: document.documentId,
    fields
  };
}

async function enrichBasicInfoWithCodex(textContent: string, fields: ReturnType<typeof extractDocumentBasicInfo>) {
  if (process.env.MSDS_CODEX_ENABLED !== "true") return fields;

  try {
    const adapter = createCodexAdapter({
      enabled: true,
      command: process.env.MSDS_CODEX_COMMAND || "codex",
      model: process.env.MSDS_CODEX_MODEL || undefined,
      timeoutMs: Number(process.env.MSDS_CODEX_TIMEOUT_MS || 60_000)
    });
    return await adapter.enrichBasicInfo({ text: textContent, localFields: fields });
  } catch {
    return fields;
  }
}

function readBasicInfoFields(body: unknown) {
  const input = body as { fields?: unknown };
  if (!Array.isArray(input.fields)) {
    throw new Error("fields array is required");
  }
  return input.fields.map((field) => {
    const item = field as Record<string, unknown>;
    const key = String(item.key ?? "").trim();
    const label = String(item.label ?? "").trim();
    if (!key || !label) {
      throw new Error("basic info key and label are required");
    }
    return {
      key,
      label,
      value: String(item.value ?? ""),
      source: String(item.value ?? "").trim() ? "user_saved" as const : "manual_required" as const
    };
  });
}

documentsRouter.post("/:documentId/components", (req, res, next) => {
  try {
    const input = readComponentCandidateBody(req.body);
    const rowId = insertManualComponentRow(getDb(), req.params.documentId, input);
    res.json({ rowId, rows: listComponentRows(getDb(), req.params.documentId) });
  } catch (error) {
    next(error);
  }
});

documentsRouter.patch("/:documentId/components/:rowId", (req, res, next) => {
  try {
    const input = readComponentCandidateBody(req.body);
    updateComponentCandidate(getDb(), req.params.rowId, input);
    res.json({ rows: listComponentRows(getDb(), req.params.documentId) });
  } catch (error) {
    next(error);
  }
});

documentsRouter.delete("/:documentId/components/:rowId", (req, res, next) => {
  try {
    removeComponentRow(getDb(), req.params.rowId);
    res.json({ rows: listComponentRows(getDb(), req.params.documentId) });
  } catch (error) {
    next(error);
  }
});

documentsRouter.post("/:documentId/components/:rowId/recheck", async (req, res, next) => {
  try {
    const result = await recheckComponentRegulatoryData(getDb(), req.params.documentId, req.params.rowId);
    res.json({ result, rows: listComponentRows(getDb(), req.params.documentId) });
  } catch (error) {
    next(error);
  }
});

function readComponentCandidateBody(body: unknown) {
  const input = body as Record<string, unknown>;
  const casNoCandidate = String(input.casNoCandidate ?? "").trim();
  const chemicalNameCandidate = String(input.chemicalNameCandidate ?? "").trim();
  const contentMinCandidate = String(input.contentMinCandidate ?? "").trim();
  const contentMaxCandidate = String(input.contentMaxCandidate ?? "").trim();
  const contentSingleCandidate = String(input.contentSingleCandidate ?? "").trim();
  if (!casNoCandidate && !chemicalNameCandidate) {
    throw new Error("CAS No. 또는 화학물질명 중 하나는 필요합니다.");
  }
  return {
    casNoCandidate,
    chemicalNameCandidate,
    contentMinCandidate,
    contentMaxCandidate,
    contentSingleCandidate
  };
}

documentsRouter.post("/:documentId/components/:rowId/review", (req, res, next) => {
  try {
    const reviewStatus = String(req.body.reviewStatus ?? "");
    if (!["needs_review", "approved", "edited", "excluded"].includes(reviewStatus)) {
      res.status(400).json({ error: "invalid reviewStatus" });
      return;
    }
    updateComponentReviewStatus(getDb(), req.params.rowId, reviewStatus as "needs_review" | "approved" | "edited" | "excluded");
    res.json({ rows: listComponentRows(getDb(), req.params.documentId) });
  } catch (error) {
    next(error);
  }
});

documentsRouter.post("/upload", upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "file is required" });
      return;
    }

    const db = getDb();
    const documentId = nanoid();
    const fileName = normalizeUploadedFileName(req.file.originalname);
    const uploadsDir = path.resolve(process.cwd(), "storage", "uploads");
    mkdirSync(uploadsDir, { recursive: true });
    const storagePath = path.join(uploadsDir, `${documentId}-${fileName}`);
    writeFileSync(storagePath, req.file.buffer);
    const fileHash = crypto.createHash("sha256").update(req.file.buffer).digest("hex");

    insertDocument(db, {
      documentId,
      fileName,
      fileHash,
      storagePath,
      status: "uploaded"
    });

    const extracted = await extractPdfText(req.file.buffer);
    const result = await processExtractedText(db, {
      documentId,
      fileName,
      fileHash,
      storagePath,
      text: extracted.text,
      pageCount: extracted.pageCount
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});
