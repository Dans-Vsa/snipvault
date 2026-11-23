import { timingSafeEqual, createHash } from "node:crypto";
import { HttpError } from "./errors.js";

const digest = (value) => createHash("sha256").update(value).digest();

/** Extract the presented API key from `X-API-Key` or `Authorization: Bearer <key>`. */
export function extractApiKey(req) {
  const header = req.get("x-api-key");
  if (header) return header;
  const auth = req.get("authorization");
  const match = auth && /^Bearer\s+(.+)$/i.exec(auth);
  return match ? match[1].trim() : null;
}

/**
 * Express middleware requiring a valid API key. With an empty key list auth is
 * disabled (open mode). Keys are compared in constant time.
 */
export function apiKeyAuth(keys = []) {
  const digests = keys.map(digest);
  return (req, _res, next) => {
    if (digests.length === 0) return next();
    const presented = extractApiKey(req);
    if (!presented) return next(new HttpError(401, "API key required (X-API-Key or Bearer token)"));
    const candidate = digest(presented);
    // Check every key (no early exit) to keep timing independent of which one matched.
    let ok = false;
    for (const d of digests) ok = timingSafeEqual(d, candidate) || ok;
    if (!ok) return next(new HttpError(401, "Invalid API key"));
    next();
  };
}
