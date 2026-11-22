import { HttpError } from "./errors.js";

const LIMITS = { title: 200, language: 40, code: 100_000, description: 2000 };
const MAX_TAGS = 10;
const TAG_RE = /^[a-z0-9][a-z0-9._+-]{0,29}$/;

/**
 * Validate a snippet payload. With `partial` true (PATCH) every field is optional,
 * otherwise `title` and `code` are required.
 */
export function parseSnippetInput(body, { partial = false } = {}) {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    throw new HttpError(400, "Request body must be a JSON object");
  }
  const errors = [];
  const out = {};

  const str = (key, { required = false, allowEmpty = false } = {}) => {
    if (!(key in body)) {
      if (required && !partial) errors.push(`${key} is required`);
      return;
    }
    const v = body[key];
    if (typeof v !== "string") return errors.push(`${key} must be a string`);
    const value = key === "code" ? v : v.trim();
    if (!allowEmpty && value.trim() === "") return errors.push(`${key} must not be empty`);
    if (value.length > LIMITS[key]) return errors.push(`${key} must be at most ${LIMITS[key]} characters`);
    out[key] = value;
  };

  str("title", { required: true });
  str("code", { required: true });
  str("language");
  str("description", { allowEmpty: true });
  if ("language" in out) out.language = out.language.toLowerCase();

  if ("favorite" in body) {
    if (typeof body.favorite !== "boolean") errors.push("favorite must be a boolean");
    else out.favorite = body.favorite;
  }

  if ("tags" in body) {
    if (!Array.isArray(body.tags) || body.tags.some((t) => typeof t !== "string")) {
      errors.push("tags must be an array of strings");
    } else {
      const tags = [...new Set(body.tags.map((t) => t.trim().toLowerCase()))];
      if (tags.length > MAX_TAGS) errors.push(`at most ${MAX_TAGS} tags are allowed`);
      const bad = tags.filter((t) => !TAG_RE.test(t));
      if (bad.length) errors.push(`invalid tag(s): ${bad.join(", ")} (use 1-30 chars: a-z, 0-9, . _ + -)`);
      out.tags = tags;
    }
  }

  if (errors.length) throw new HttpError(400, "Validation failed", errors);
  if (partial && Object.keys(out).length === 0) {
    throw new HttpError(400, "No updatable fields provided");
  }
  return out;
}

export function parseId(raw) {
  const id = Number(raw);
  if (!Number.isInteger(id) || id < 1) throw new HttpError(400, "id must be a positive integer");
  return id;
}

const SORTS = { created: "created_at", updated: "updated_at", title: "title" };

/** Validate and normalise the query string of `GET /snippets`. */
export function parseListQuery(query) {
  const errors = [];
  const out = { tags: [], sort: "created", order: "desc", limit: 20, offset: 0 };

  const one = (key) => {
    const v = query[key];
    if (v === undefined) return undefined;
    if (typeof v !== "string") {
      errors.push(`${key} must be a single value`);
      return undefined;
    }
    return v;
  };
  const int = (key, min, max) => {
    const raw = one(key);
    if (raw === undefined) return;
    const n = Number(raw);
    if (raw.trim() === "" || !Number.isInteger(n) || n < min || n > max) {
      errors.push(`${key} must be an integer between ${min} and ${max}`);
    } else out[key] = n;
  };

  const q = one("q");
  if (q !== undefined && q.trim() !== "") out.q = q.trim().slice(0, 200);
  const language = one("language");
  if (language !== undefined && language.trim() !== "") out.language = language.trim().toLowerCase();

  const favorite = one("favorite");
  if (favorite !== undefined) {
    if (favorite === "true") out.favorite = true;
    else if (favorite === "false") out.favorite = false;
    else errors.push("favorite must be true or false");
  }

  const rawTags = query.tag === undefined ? [] : [].concat(query.tag);
  if (rawTags.some((t) => typeof t !== "string")) errors.push("tag must be a string");
  else out.tags = [...new Set(rawTags.flatMap((t) => t.split(",")).map((t) => t.trim().toLowerCase()).filter(Boolean))];

  const sort = one("sort");
  if (sort !== undefined) {
    if (sort in SORTS || sort === "relevance") out.sort = sort;
    else errors.push("sort must be one of: created, updated, title, relevance");
  }
  const order = one("order");
  if (order !== undefined) {
    if (order === "asc" || order === "desc") out.order = order;
    else errors.push("order must be asc or desc");
  }
  int("limit", 1, 100);
  int("offset", 0, 1_000_000);

  if (out.sort === "relevance" && !out.q) errors.push("sort=relevance requires q");
  if (errors.length) throw new HttpError(400, "Invalid query parameters", errors);
  if (out.q && query.sort === undefined) out.sort = "relevance";
  return out;
}

export { SORTS };
