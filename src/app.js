import express from "express";
import { HttpError } from "./errors.js";
import { parseId, parseSnippetInput } from "./validate.js";
import { createSnippetRepository } from "./repository.js";

/** Build the Express app around a SQLite database handle. */
export function createApp(db) {
  const repo = createSnippetRepository(db);
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "512kb" }));

  app.get("/health", (_req, res) => res.json({ status: "ok" }));

  app.post("/snippets", (req, res) => {
    const data = parseSnippetInput(req.body);
    res.status(201).json(repo.create(data));
  });

  app.get("/snippets", (_req, res) => {
    res.json({ data: repo.list() });
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
