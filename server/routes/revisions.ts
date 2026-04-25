import { Router } from "express";
import { diffComponentRevisions } from "../services/revisionDiff";

export const revisionsRouter = Router();

revisionsRouter.post("/diff", (req, res) => {
  res.json({ diffs: diffComponentRevisions(req.body.before ?? [], req.body.after ?? []) });
});
