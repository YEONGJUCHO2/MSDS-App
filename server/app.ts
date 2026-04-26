import "./config/loadEnv";
import express from "express";
import { getDb } from "./db/connection";
import { documentsRouter } from "./routes/documents";
import { importsRouter } from "./routes/imports";
import { productsRouter } from "./routes/products";
import { queuesRouter } from "./routes/queues";
import { officialLookupsRouter } from "./routes/officialLookups";
import { revisionsRouter } from "./routes/revisions";
import { schedulesRouter } from "./routes/schedules";
import { watchlistRouter } from "./routes/watchlist";
import { corsMiddleware } from "./middleware/cors";

export function createApp() {
  const app = express();

  getDb();
  app.use(corsMiddleware);
  app.use(express.json({ limit: "10mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, name: "MSDS Watcher" });
  });

  app.use("/api/documents", documentsRouter);
  app.use("/api/imports", importsRouter);
  app.use("/api/official-lookups", officialLookupsRouter);
  app.use("/api/products", productsRouter);
  app.use("/api/queues", queuesRouter);
  app.use("/api/revisions", revisionsRouter);
  app.use("/api/schedules", schedulesRouter);
  app.use("/api/watchlist", watchlistRouter);

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const message = error instanceof Error ? error.message : "Unknown server error";
    res.status(500).json({ error: message });
  });

  return app;
}

export const app = createApp();
