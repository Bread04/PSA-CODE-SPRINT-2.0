import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import { applyDecision, getDisruptionById, getOverview, listDisruptions } from "./operations.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isProduction = process.env.NODE_ENV === "production" || !process.env.NODE_ENV;

async function startServer() {
  const app = express();
  const server = createServer(app);

  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({
      ok: true,
      service: "portwatch-tuas",
      mode: process.env.NODE_ENV === "production" ? "production" : "development",
      timestamp: new Date().toISOString(),
    });
  });

  app.get("/api/overview", (_req, res) => {
    res.json(getOverview());
  });

  app.get("/api/disruptions", (_req, res) => {
    res.json(listDisruptions());
  });

  app.get("/api/disruptions/:id", (req, res) => {
    const disruption = getDisruptionById(req.params.id);
    if (!disruption) {
      res.status(404).json({ error: "Disruption not found" });
      return;
    }

    res.json(disruption);
  });

  app.post("/api/disruptions/:id/decision", (req, res) => {
    const { optionId, actor, approved, summary } = req.body ?? {};

    if (!optionId || typeof optionId !== "string") {
      res.status(400).json({ error: "optionId is required" });
      return;
    }

    try {
      const disruption = applyDecision(req.params.id, optionId, {
        actor: typeof actor === "string" ? actor : undefined,
        approved: typeof approved === "boolean" ? approved : undefined,
        summary: typeof summary === "string" ? summary : undefined,
      });

      res.json({
        ok: true,
        disruption,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Decision could not be recorded";
      res.status(404).json({ error: message });
    }
  });

  // Serve static files from dist/public in production
  const staticPath = isProduction
    ? path.resolve(__dirname, "public")
    : path.resolve(__dirname, "..", "dist", "public");

  app.use(express.static(staticPath));

  app.get("*", (_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });

  const port = process.env.PORT || 3000;

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
