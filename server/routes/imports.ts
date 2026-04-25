import { Router } from "express";
import { getDb } from "../db/connection";
import { importProductMasterCsv } from "../importers/masterImport";
import { importRegulatorySeedCsv } from "../importers/regulatorySeedImport";

export const importsRouter = Router();

importsRouter.post("/regulatory-seeds", (req, res) => {
  const result = importRegulatorySeedCsv(getDb(), String(req.body.csv ?? ""));
  res.json(result);
});

importsRouter.post("/product-master", (req, res) => {
  const result = importProductMasterCsv(getDb(), String(req.body.csv ?? ""));
  res.json(result);
});
