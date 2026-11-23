import { HttpError } from "./errors.js";

/**
 * Fixed-window in-memory rate limiter keyed by client IP. It runs before auth so
 * key guessing is throttled too. `max <= 0` disables limiting.
 * Adds `X-RateLimit-Limit/Remaining/Reset` headers and answers 429 with `Retry-After`.
 */
export function rateLimit({ max = 100, windowMs = 60_000, now = Date.now } = {}) {
  if (max <= 0) return (_req, _res, next) => next();
  const hits = new Map();

  // Drop expired windows so the map cannot grow without bound.
  const sweep = setInterval(() => {
    const t = now();
    for (const [k, v] of hits) if (v.resetAt <= t) hits.delete(k);
  }, windowMs);
  sweep.unref();

  return (req, res, next) => {
    const t = now();
    const id = req.ip;
    let entry = hits.get(id);
    if (!entry || entry.resetAt <= t) {
      entry = { count: 0, resetAt: t + windowMs };
      hits.set(id, entry);
    }
    entry.count += 1;
    const resetSec = Math.ceil((entry.resetAt - t) / 1000);
    res.set("X-RateLimit-Limit", String(max));
    res.set("X-RateLimit-Remaining", String(Math.max(0, max - entry.count)));
    res.set("X-RateLimit-Reset", String(resetSec));
    if (entry.count > max) {
      res.set("Retry-After", String(resetSec));
      return next(new HttpError(429, "Too many requests"));
    }
    next();
  };
}
