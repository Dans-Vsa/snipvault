import { createApp } from "./app.js";
import { openDb } from "./db.js";
import { VERSION } from "./version.js";

const port = Number(process.env.PORT ?? 3000);
const dbPath = process.env.DB_PATH ?? "data/snipvault.db";
const apiKeys = (process.env.API_KEYS ?? "").split(",").map((k) => k.trim()).filter(Boolean);
const rateLimitMax = Number(process.env.RATE_LIMIT_MAX ?? 100);
const rateLimitWindowMs = Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000);

if (apiKeys.length === 0) console.warn("WARNING: API_KEYS is not set - authentication is disabled.");

const db = openDb(dbPath);
const app = createApp(db, { apiKeys, rateLimitMax, rateLimitWindowMs });
const server = app.listen(port, () =>
  console.log(`snipvault v${VERSION} listening on http://localhost:${port} (db: ${dbPath})`),
);

/** Stop accepting connections, let in-flight requests finish, then close the database. */
function shutdown(signal) {
  console.log(`${signal} received, shutting down...`);
  const force = setTimeout(() => process.exit(1), 10_000);
  force.unref();
  server.close(() => {
    db.close();
    process.exit(0);
  });
  server.closeIdleConnections?.();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
