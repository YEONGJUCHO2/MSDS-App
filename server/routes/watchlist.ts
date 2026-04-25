import { Router } from "express";
import { getDb } from "../db/connection";
import { recheckWatchlistRegulatoryData } from "../services/regulatoryMatcher";

export const watchlistRouter = Router();

watchlistRouter.get("/", (_req, res) => {
  const rows = getDb().prepare(`
    SELECT watch_id AS watchId, cas_no AS casNo, chemical_name AS chemicalName, last_source_name AS lastSourceName, last_checked_at AS lastCheckedAt, status
    FROM watchlist
    ORDER BY last_checked_at DESC
  `).all();
  res.json({ items: rows });
});

watchlistRouter.post("/recheck", async (req, res, next) => {
  try {
    const watchIds = Array.isArray(req.body?.watchIds) ? req.body.watchIds.map(String).filter(Boolean) : undefined;
    const results = await recheckWatchlistRegulatoryData(getDb(), watchIds);
    const rows = getDb().prepare(`
      SELECT watch_id AS watchId, cas_no AS casNo, chemical_name AS chemicalName, last_source_name AS lastSourceName, last_checked_at AS lastCheckedAt, status
      FROM watchlist
      ORDER BY last_checked_at DESC
    `).all();
    res.json({ results, items: rows });
  } catch (error) {
    next(error);
  }
});
