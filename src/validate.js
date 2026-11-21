import { HttpError } from "./errors.js";

const LIMITS = { title: 200, language: 40, code: 100_000, description: 2000 };

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
