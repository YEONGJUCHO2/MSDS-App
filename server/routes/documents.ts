import { Router, type NextFunction, type Request, type Response } from "express";
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
  upsertGeneratedDocumentBasicInfo,
  upsertDocumentBasicInfo,
  updateComponentCandidate,
  updateComponentReviewStatus
} from "../db/repositories";
import { normalizeUploadedFileName } from "../services/fileName";
import { extractDocumentBasicInfo } from "../services/basicInfoExtractor";
import { createConfiguredAiAdapter, resolveAiProvider } from "../services/aiProvider";
import { createOcrAdapter } from "../services/ocrAdapter";
import { extractPdfText } from "../services/pdfExtractor";
import { processExtractedText } from "../services/processingPipeline";
import { recheckComponentRegulatoryData } from "../services/regulatoryMatcher";
import { createDocumentStorage } from "../storage/documentStorage";
import { MAX_UPLOAD_FILES_PER_BATCH } from "../../shared/uploadLimits";

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
      await createDocumentStorage().remove(deleted.storagePath);
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
    : await enrichBasicInfoWithAi(documentId, document.textContent, extractedFields);

  return {
    documentId: document.documentId,
    fields
  };
}

async function enrichBasicInfoWithAi(documentId: string, textContent: string, fields: ReturnType<typeof extractDocumentBasicInfo>) {
  const providerConfig = resolveAiProvider();
  if (providerConfig.provider === "local") return fields;

  const adapter = createConfiguredAiAdapter(providerConfig);
  if (!adapter) return fields;

  try {
    const enrichment = adapter.enrichBasicInfo({ text: textContent, localFields: fields });
    return await withBasicInfoTimeout(
      enrichment,
      fields,
      Number(process.env.MSDS_AI_BASIC_INFO_TIMEOUT_MS || 5_000),
      (enrichedFields) => {
        upsertGeneratedDocumentBasicInfo(getDb(), documentId, enrichedFields);
      }
    );
  } catch {
    return fields;
  }
}

export async function withBasicInfoTimeout<T>(operation: Promise<T>, fallback: T, timeoutMs: number, onCompleted?: (value: T) => void) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  operation.then((value) => onCompleted?.(value)).catch(() => undefined);
  try {
    return await Promise.race([
      operation,
      new Promise<T>((resolve) => {
        timeout = setTimeout(() => resolve(fallback), timeoutMs);
      })
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
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
    const stored = await createDocumentStorage().save({
      documentId,
      fileName,
      buffer: req.file.buffer
    });

    insertDocument(db, {
      documentId,
      fileName,
      fileHash: stored.fileHash,
      storagePath: stored.storagePath,
      status: "uploaded"
    });

    const extracted = await extractPdfText(req.file.buffer);
    const result = await processExtractedText(db, {
      documentId,
      fileName,
      fileHash: stored.fileHash,
      storagePath: stored.storagePath,
      text: extracted.text,
      pageCount: extracted.pageCount,
      pdfBuffer: req.file.buffer,
      ocrAdapter: createUploadOcrAdapter()
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

const uploadBatchMiddleware = upload.array("files", MAX_UPLOAD_FILES_PER_BATCH);

documentsRouter.post("/upload-batch", (req, res, next) => {
  uploadBatchMiddleware(req, res, (error) => {
    if (error instanceof multer.MulterError && error.code === "LIMIT_UNEXPECTED_FILE") {
      res.status(400).json({ error: `한 번에 최대 ${MAX_UPLOAD_FILES_PER_BATCH}개까지만 업로드할 수 있습니다.` });
      return;
    }
    if (error) {
      next(error);
      return;
    }
    void handleUploadBatch(req, res, next);
  });
});

async function handleUploadBatch(req: Request, res: Response, next: NextFunction) {
  try {
    const files = Array.isArray(req.files) ? req.files : [];
    if (files.length === 0) {
      res.status(400).json({ error: "files are required" });
      return;
    }
    if (files.length > MAX_UPLOAD_FILES_PER_BATCH) {
      res.status(400).json({ error: `한 번에 최대 ${MAX_UPLOAD_FILES_PER_BATCH}개까지만 업로드할 수 있습니다.` });
      return;
    }

    const results = await processUploadBatchFiles(files);
    res.json({ results });
  } catch (error) {
    next(error);
  }
}

export async function processUploadBatchFiles(
  files: Pick<Express.Multer.File, "originalname">[],
  processFile: (file: Express.Multer.File) => Promise<Record<string, unknown>> = processUploadedFile
) {
  const results = [];
  for (const file of files) {
    try {
      results.push({ success: true, ...(await processFile(file as Express.Multer.File)) });
    } catch (error) {
      results.push({
        success: false,
        fileName: normalizeUploadedFileName(file.originalname),
        error: error instanceof Error ? error.message : "Unknown upload error"
      });
    }
  }
  return results;
}

async function processUploadedFile(file: Express.Multer.File) {
  const db = getDb();
  const documentId = nanoid();
  const fileName = normalizeUploadedFileName(file.originalname);
  const stored = await createDocumentStorage().save({
    documentId,
    fileName,
    buffer: file.buffer
  });

  insertDocument(db, {
    documentId,
    fileName,
    fileHash: stored.fileHash,
    storagePath: stored.storagePath,
    status: "uploaded"
  });

  const extracted = await extractPdfText(file.buffer);
  const result = await processExtractedText(db, {
    documentId,
    fileName,
    fileHash: stored.fileHash,
    storagePath: stored.storagePath,
    text: extracted.text,
    pageCount: extracted.pageCount,
    pdfBuffer: file.buffer,
    ocrAdapter: createUploadOcrAdapter()
  });

  return {
    fileName,
    ...result
  };
}

function createUploadOcrAdapter() {
  return createOcrAdapter({ enabled: process.env.MSDS_OCR_ENABLED !== "false" });
}
