import crypto from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Router } from "express";
import multer from "multer";
import { nanoid } from "nanoid";
import { getDb } from "../db/connection";
import {
  insertDocument,
  insertManualComponentRow,
  listComponentRows,
  listDocuments,
  removeComponentRow,
  updateComponentCandidate,
  updateComponentReviewStatus
} from "../db/repositories";
import { normalizeUploadedFileName } from "../services/fileName";
import { extractDocumentBasicInfo } from "../services/basicInfoExtractor";
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

documentsRouter.get("/:documentId/basic-info", (req, res) => {
  const db = getDb();
  const document = db.prepare(`
    SELECT
      document_id AS documentId,
      file_name AS fileName,
      text_content AS textContent
    FROM documents
    WHERE document_id = ?
  `).get(req.params.documentId) as { documentId: string; fileName: string; textContent: string } | undefined;

  if (!document) {
    res.status(404).json({ error: "document not found" });
    return;
  }

  const product = db.prepare(`
    SELECT GROUP_CONCAT(site_names, ', ') AS siteNames
    FROM products
    WHERE document_id = ?
      AND site_names != ''
  `).get(req.params.documentId) as { siteNames: string | null } | undefined;
  const queue = db.prepare(`
    SELECT COUNT(*) AS count
    FROM review_queue
    WHERE document_id = ?
      AND review_status = 'needs_review'
  `).get(req.params.documentId) as { count: number };

  res.json({
    documentId: document.documentId,
    fields: extractDocumentBasicInfo({
      fileName: document.fileName,
      textContent: document.textContent,
      siteNames: product?.siteNames ?? "",
      queueCount: queue.count
    })
  });
});

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
