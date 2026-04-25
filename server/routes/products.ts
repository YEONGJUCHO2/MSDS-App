import { Router } from "express";
import { getDb } from "../db/connection";

export const productsRouter = Router();

productsRouter.get("/", (_req, res) => {
  const rows = getDb().prepare(`
    SELECT product_id AS productId, product_name AS productName, supplier, manufacturer, site_names AS siteNames, registration_status AS registrationStatus
    FROM products
    ORDER BY created_at DESC
  `).all();
  res.json({ products: rows });
});
