import { Router } from "express";
import { getDb } from "../db/connection";
import { pruneOrphanWatchlist } from "../db/repositories";
import { recheckWatchlistRegulatoryData } from "../services/regulatoryMatcher";

export const watchlistRouter = Router();

watchlistRouter.get("/", (_req, res) => {
  res.json({ items: listCurrentWatchlistItems() });
});

watchlistRouter.post("/recheck", async (req, res, next) => {
  try {
    const watchIds = Array.isArray(req.body?.watchIds) ? req.body.watchIds.map(String).filter(Boolean) : undefined;
    const db = getDb();
    pruneOrphanWatchlist(db);
    const results = await recheckWatchlistRegulatoryData(db, watchIds);
    res.json({ results, items: listCurrentWatchlistItems() });
  } catch (error) {
    next(error);
  }
});

function listCurrentWatchlistItems() {
  const db = getDb();
  pruneOrphanWatchlist(db);
  return db.prepare(`
    SELECT watch_id AS watchId, cas_no AS casNo, chemical_name AS chemicalName, last_source_name AS lastSourceName, last_checked_at AS lastCheckedAt, status
    FROM watchlist
    ORDER BY last_checked_at DESC
  `).all();
}
