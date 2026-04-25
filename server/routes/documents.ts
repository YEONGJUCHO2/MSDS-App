import crypto from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Router } from "express";
import multer from "multer";
import { nanoid } from "nanoid";
import { getDb } from "../db/connection";
import { insertDocument, listComponentRows, listDocuments } from "../db/repositories";
import { normalizeUploadedFileName } from "../services/fileName";
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

documentsRouter.post("/:documentId/components/:rowId/recheck", async (req, res, next) => {
  try {
    const result = await recheckComponentRegulatoryData(getDb(), req.params.documentId, req.params.rowId);
    res.json({ result, rows: listComponentRows(getDb(), req.params.documentId) });
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
