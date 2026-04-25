import { Router } from "express";
import { getDb } from "../db/connection";
import { getOfficialLookupStatus } from "../services/officialLookupStatus";

export const officialLookupsRouter = Router();

officialLookupsRouter.get("/status", (_req, res) => {
  res.json({ providers: getOfficialLookupStatus(getDb()) });
});
