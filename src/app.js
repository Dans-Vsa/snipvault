import express from "express";
import { HttpError } from "./errors.js";
import { parseId, parseImport, parseListQuery, parseSnippetInput } from "./validate.js";
import { createSnippetRepository } from "./repository.js";
import { apiKeyAuth } from "./auth.js";
import { rateLimit } from "./ratelimit.js";
import { buildOpenApiSpec, DOCS_HTML } from "./openapi.js";
import { VERSION } from "./version.js";

/**
 * Build the Express app around a SQLite database handle.
 * @param {object} [options]
 * @param {string[]} [options.apiKeys]   Accepted API keys; empty = auth disabled.
 * @param {number}   [options.rateLimitMax]      Requests per window per IP; 0 = unlimited.
 * @param {number}   [options.rateLimitWindowMs] Window length in ms (default 60000).
 */
export function createApp(db, { apiKeys = [], rateLimitMax = 0, rateLimitWindowMs = 60_000 } = {}) {
  const repo = createSnippetRepository(db);
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", false);
  app.use(rateLimit({ max: rateLimitMax, windowMs: rateLimitWindowMs }));
  app.use(express.json({ limit: "5mb" }));

  // Public routes
  app.get("/health", (_req, res) => res.json({ status: "ok", version: VERSION }));
  app.get("/openapi.json", (_req, res) => res.json(buildOpenApiSpec({ version: VERSION })));
  app.get("/docs", (_req, res) => res.type("html").send(DOCS_HTML));

  // Everything below requires an API key (when keys are configured)
  app.use(apiKeyAuth(apiKeys));

  app.get("/export", (_req, res) => {
    res.set("Content-Disposition", 'attachment; filename="snipvault-export.json"');
    res.json({ version: 1, exportedAt: new Date().toISOString(), snippets: repo.exportAll() });
  });

  app.post("/import", (req, res) => {
    res.json({ imported: repo.importMany(parseImport(req.body)) });
  });

  app.post("/snippets", (req, res) => {
    const data = parseSnippetInput(req.body);
    res.status(201).json(repo.create(data));
  });

  app.get("/snippets", (req, res) => {
    res.json(repo.list(parseListQuery(req.query)));
  });

  app.get("/tags", (_req, res) => {
    res.json({ data: repo.listTags() });
  });

  app.get("/snippets/:id", (req, res) => {
    const snippet = repo.get(parseId(req.params.id));
    if (!snippet) throw new HttpError(404, "Snippet not found");
    res.json(snippet);
  });

  app.patch("/snippets/:id", (req, res) => {
    const id = parseId(req.params.id);
    const snippet = repo.update(id, parseSnippetInput(req.body, { partial: true }));
    if (!snippet) throw new HttpError(404, "Snippet not found");
    res.json(snippet);
  });

  app.delete("/snippets/:id", (req, res) => {
    if (!repo.delete(parseId(req.params.id))) throw new HttpError(404, "Snippet not found");
    res.status(204).end();
  });

  app.use((_req, _res, next) => next(new HttpError(404, "Route not found")));

  app.use((err, _req, res, _next) => {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: err.message, ...(err.details && { details: err.details }) });
    }
    if (err.type === "entity.parse.failed") return res.status(400).json({ error: "Invalid JSON body" });
    if (err.type === "entity.too.large") return res.status(413).json({ error: "Payload too large" });
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}
