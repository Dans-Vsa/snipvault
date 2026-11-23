const snippetProps = {
  title: { type: "string", maxLength: 200 },
  language: { type: "string", maxLength: 40, default: "text" },
  code: { type: "string", maxLength: 100000 },
  description: { type: "string", maxLength: 2000 },
  favorite: { type: "boolean" },
  tags: { type: "array", maxItems: 10, items: { type: "string", pattern: "^[a-z0-9][a-z0-9._+-]{0,29}$" } },
};

const err = (description) => ({
  description,
  content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
});
const idParam = { name: "id", in: "path", required: true, schema: { type: "integer", minimum: 1 } };
const secured = [{ ApiKey: [] }, { BearerAuth: [] }];
const json = (schema) => ({ "application/json": { schema } });
const ref = (name) => ({ $ref: `#/components/schemas/${name}` });

const q = (name, description, schema) => ({ name, in: "query", description, schema });

/** OpenAPI 3.0 description of the API, served at `/openapi.json`. */
export function buildOpenApiSpec({ version = "1.0.0" } = {}) {
  return {
    openapi: "3.0.3",
    info: {
      title: "snipvault API",
      version,
      description: "Self-hosted REST API for storing, tagging and searching code snippets.",
      license: { name: "MIT" },
    },
    paths: {
      "/health": {
        get: {
          summary: "Liveness check",
          security: [],
          responses: { 200: { description: "OK", content: json({ type: "object", properties: { status: { type: "string" } } }) } },
        },
      },
      "/snippets": {
        get: {
          summary: "Search, filter, sort and paginate snippets",
          security: secured,
          parameters: [
            q("q", "Full-text query (last word is a prefix)", { type: "string" }),
            q("language", "Exact language", { type: "string" }),
            q("favorite", "Only favorites / non-favorites", { type: "boolean" }),
            q("tag", "Repeatable or comma-separated; all must match", { type: "array", items: { type: "string" } }),
            q("sort", "Sort field", { type: "string", enum: ["created", "updated", "title", "relevance"] }),
            q("order", "Sort direction", { type: "string", enum: ["asc", "desc"] }),
            q("limit", "Page size", { type: "integer", minimum: 1, maximum: 100, default: 20 }),
            q("offset", "Page offset", { type: "integer", minimum: 0, default: 0 }),
          ],
          responses: { 200: { description: "A page of snippets", content: json(ref("SnippetPage")) }, 400: err("Invalid query"), 401: err("Unauthorized") },
        },
        post: {
          summary: "Create a snippet",
          security: secured,
          requestBody: { required: true, content: json(ref("SnippetInput")) },
          responses: { 201: { description: "Created", content: json(ref("Snippet")) }, 400: err("Validation failed"), 401: err("Unauthorized") },
        },
      },
      "/snippets/{id}": {
        parameters: [idParam],
        get: {
          summary: "Fetch one snippet",
          security: secured,
          responses: { 200: { description: "The snippet", content: json(ref("Snippet")) }, 404: err("Not found"), 401: err("Unauthorized") },
        },
        patch: {
          summary: "Partially update a snippet",
          security: secured,
          requestBody: { required: true, content: json(ref("SnippetInput")) },
          responses: { 200: { description: "Updated", content: json(ref("Snippet")) }, 400: err("Validation failed"), 404: err("Not found"), 401: err("Unauthorized") },
        },
        delete: {
          summary: "Delete a snippet",
          security: secured,
          responses: { 204: { description: "Deleted" }, 404: err("Not found"), 401: err("Unauthorized") },
        },
      },
      "/tags": {
        get: {
          summary: "List tags with usage counts",
          security: secured,
          responses: { 200: { description: "Tags", content: json({ type: "object", properties: { data: { type: "array", items: ref("Tag") } } }) }, 401: err("Unauthorized") },
        },
      },
      "/export": {
        get: {
          summary: "Export every snippet as a JSON document",
          security: secured,
          responses: { 200: { description: "Export document", content: json(ref("Export")) }, 401: err("Unauthorized") },
        },
      },
      "/import": {
        post: {
          summary: "Import snippets from an export document",
          description: "Atomic: if any snippet is invalid nothing is imported.",
          security: secured,
          requestBody: { required: true, content: json(ref("Export")) },
          responses: {
            200: { description: "Import summary", content: json({ type: "object", properties: { imported: { type: "integer" } } }) },
            400: err("Validation failed"),
            401: err("Unauthorized"),
          },
        },
      },
    },
    components: {
      securitySchemes: {
        ApiKey: { type: "apiKey", in: "header", name: "X-API-Key" },
        BearerAuth: { type: "http", scheme: "bearer" },
      },
      schemas: {
        SnippetInput: { type: "object", required: ["title", "code"], properties: snippetProps },
        Snippet: {
          type: "object",
          properties: {
            id: { type: "integer" },
            ...snippetProps,
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        SnippetPage: {
          type: "object",
          properties: {
            data: { type: "array", items: ref("Snippet") },
            total: { type: "integer" },
            limit: { type: "integer" },
            offset: { type: "integer" },
          },
        },
        Tag: { type: "object", properties: { name: { type: "string" }, count: { type: "integer" } } },
        Export: {
          type: "object",
          required: ["snippets"],
          properties: {
            version: { type: "integer", example: 1 },
            exportedAt: { type: "string", format: "date-time" },
            snippets: { type: "array", items: ref("SnippetInput") },
          },
        },
        Error: {
          type: "object",
          properties: { error: { type: "string" }, details: { type: "array", items: { type: "string" } } },
        },
      },
    },
  };
}

/** Minimal HTML page rendering the spec with Swagger UI (assets loaded from a CDN). */
export const DOCS_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>snipvault API docs</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14/swagger-ui.css">
</head>
<body>
  <div id="ui"></div>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14/swagger-ui-bundle.js"></script>
  <script>SwaggerUIBundle({ url: "/openapi.json", dom_id: "#ui" });</script>
</body>
</html>
`;
