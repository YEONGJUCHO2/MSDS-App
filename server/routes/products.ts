import { Router } from "express";
import { nanoid } from "nanoid";
import { getDb } from "../db/connection";
import { normalizeUploadedFileName } from "../services/fileName";

export const productsRouter = Router();

productsRouter.get("/", (_req, res) => {
  res.json({ products: listProducts() });
});

productsRouter.post("/", (req, res) => {
  const db = getDb();
  const documentId = String(req.body?.documentId ?? "").trim();
  const siteNames = String(req.body?.siteNames ?? "").trim();
  if (!documentId) {
    res.status(400).json({ error: "documentId is required" });
    return;
  }
  if (!siteNames) {
    res.status(400).json({ error: "사용현장을 입력해야 합니다." });
    return;
  }

  const document = db.prepare(`
    SELECT document_id AS documentId, file_name AS fileName
    FROM documents
    WHERE document_id = ?
  `).get(documentId) as { documentId: string; fileName: string } | undefined;
  if (!document) {
    res.status(404).json({ error: "MSDS document not found" });
    return;
  }

  const documentFileName = normalizeUploadedFileName(document.fileName);
  const product = {
    productId: nanoid(),
    documentId,
    documentFileName,
    productName: String(req.body?.productName ?? "").trim() || documentFileName.replace(/\.pdf$/i, ""),
    supplier: String(req.body?.supplier ?? "").trim(),
    manufacturer: String(req.body?.manufacturer ?? "").trim(),
    siteNames,
    registrationStatus: "linked_to_site"
  };

  db.prepare(`
    INSERT INTO products (
      product_id, document_id, document_file_name, product_name, supplier, manufacturer,
      site_names, registration_status, created_at
    ) VALUES (
      @productId, @documentId, @documentFileName, @productName, @supplier, @manufacturer,
      @siteNames, @registrationStatus, @createdAt
    )
  `).run({
    ...product,
    createdAt: new Date().toISOString()
  });

  res.json({ product, products: listProducts() });
});

function listProducts() {
  return getDb().prepare(`
    SELECT
      product_id AS productId,
      document_id AS documentId,
      document_file_name AS documentFileName,
      product_name AS productName,
      supplier,
      manufacturer,
      site_names AS siteNames,
      registration_status AS registrationStatus
    FROM products
    ORDER BY created_at DESC
  `).all();
}
