import { Router } from "express";
import { calculateScheduleFlags } from "../services/scheduleCalculator";

export const schedulesRouter = Router();

schedulesRouter.post("/calculate", (req, res) => {
  res.json({ schedules: calculateScheduleFlags(req.body.candidates ?? []) });
});
