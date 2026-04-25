import { Router } from "express";
import { getDb } from "../db/connection";
import { listReviewQueue } from "../db/repositories";

export const queuesRouter = Router();

queuesRouter.get("/", (_req, res) => {
  res.json({ items: listReviewQueue(getDb()) });
});
