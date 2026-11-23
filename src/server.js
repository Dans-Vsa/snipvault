import { createApp } from "./app.js";
import { openDb } from "./db.js";

const port = Number(process.env.PORT ?? 3000);
const dbPath = process.env.DB_PATH ?? "data/snipvault.db";
const apiKeys = (process.env.API_KEYS ?? "").split(",").map((k) => k.trim()).filter(Boolean);
const rateLimitMax = Number(process.env.RATE_LIMIT_MAX ?? 100);
const rateLimitWindowMs = Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000);

if (apiKeys.length === 0) console.warn("WARNING: API_KEYS is not set - authentication is disabled.");

const app = createApp(openDb(dbPath), { apiKeys, rateLimitMax, rateLimitWindowMs });
app.listen(port, () => console.log(`snipvault listening on http://localhost:${port} (db: ${dbPath})`));
