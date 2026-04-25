import { Router } from "express";
import { getDb } from "../db/connection";

export const watchlistRouter = Router();

watchlistRouter.get("/", (_req, res) => {
  const rows = getDb().prepare(`
    SELECT watch_id AS watchId, cas_no AS casNo, chemical_name AS chemicalName, last_source_name AS lastSourceName, last_checked_at AS lastCheckedAt, status
    FROM watchlist
    ORDER BY last_checked_at DESC
  `).all();
  res.json({ items: rows });
});
