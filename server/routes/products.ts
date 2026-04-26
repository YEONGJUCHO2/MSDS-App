import { Router } from "express";
import { nanoid } from "nanoid";
import { getDb } from "../db/connection";
import { deleteProductRecord } from "../db/repositories";
import { normalizeUploadedFileName } from "../services/fileName";

export const productsRouter = Router();

productsRouter.get("/", (_req, res) => {
  res.json({ products: listProducts() });
});

productsRouter.post("/", (req, res) => {
  const db = getDb();
  const documentId = String(req.body?.documentId ?? "").trim();
  const documentIds = Array.isArray(req.body?.documentIds)
    ? req.body.documentIds.map((id: unknown) => String(id).trim()).filter(Boolean)
    : [];
  const selectedDocumentIds = documentIds.length > 0 ? [...new Set(documentIds)] : documentId ? [documentId] : [];
  const siteNames = String(req.body?.siteNames ?? "").trim();
  if (selectedDocumentIds.length === 0) {
    res.status(400).json({ error: "documentId is required" });
    return;
  }
  if (!siteNames) {
    res.status(400).json({ error: "사용현장을 입력해야 합니다." });
    return;
  }

  const documents = db.prepare(`
    SELECT document_id AS documentId, file_name AS fileName
    FROM documents
    WHERE document_id IN (${selectedDocumentIds.map(() => "?").join(",")})
    ORDER BY uploaded_at DESC
  `).all(...selectedDocumentIds) as Array<{ documentId: string; fileName: string }>;
  if (documents.length !== selectedDocumentIds.length) {
    res.status(404).json({ error: "MSDS document not found" });
    return;
  }

  const requestedName = String(req.body?.productName ?? "").trim();
  const supplier = String(req.body?.supplier ?? "").trim();
  const manufacturer = String(req.body?.manufacturer ?? "").trim();

  const insert = db.prepare(`
    INSERT INTO products (
      product_id, document_id, document_file_name, product_name, supplier, manufacturer,
      site_names, registration_status, created_at
    ) VALUES (
      @productId, @documentId, @documentFileName, @productName, @supplier, @manufacturer,
      @siteNames, @registrationStatus, @createdAt
    )
  `);

  const products = documents.map((document) => {
    const documentFileName = normalizeUploadedFileName(document.fileName);
    return {
      productId: nanoid(),
      documentId: document.documentId,
      documentFileName,
      productName: requestedName && documents.length === 1 ? requestedName : documentFileName.replace(/\.pdf$/i, ""),
      supplier,
      manufacturer,
      siteNames,
      registrationStatus: "linked_to_site"
    };
  });

  const transaction = db.transaction(() => {
    for (const product of products) {
      insert.run({
        ...product,
        createdAt: new Date().toISOString()
      });
    }
  });
  transaction();

  res.json({ product: products[0], products: listProducts() });
});

productsRouter.delete("/:productId", (req, res) => {
  const deleted = deleteProductRecord(getDb(), req.params.productId);
  if (!deleted) {
    res.status(404).json({ error: "product not found" });
    return;
  }

  res.json({ products: listProducts() });
});

function listProducts() {
  return getDb().prepare(`
    SELECT
      products.product_id AS productId,
      products.document_id AS documentId,
      products.document_file_name AS documentFileName,
      products.product_name AS productName,
      products.supplier,
      products.manufacturer,
      products.site_names AS siteNames,
      products.registration_status AS registrationStatus,
      COALESCE(documents.status, '') AS documentStatus,
      COUNT(DISTINCT components.row_id) AS componentCount,
      COUNT(DISTINCT review_queue.queue_id) AS queueCount
    FROM products
    LEFT JOIN documents ON documents.document_id = products.document_id
    LEFT JOIN components ON components.document_id = products.document_id
    LEFT JOIN review_queue ON review_queue.document_id = products.document_id AND review_queue.review_status = 'needs_review'
    GROUP BY products.product_id
    ORDER BY products.created_at DESC
  `).all();
}
