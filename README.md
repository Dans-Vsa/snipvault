# snipvault

A tiny self-hosted REST API for storing, tagging and searching code snippets.
Built with Node.js, Express 5 and the built-in `node:sqlite` module — a single runtime dependency, no native compilation.

> Status: **work in progress** (milestone 2 of 4).

## Features

- [x] Create / read / update / delete snippets (`title`, `language`, `code`, `description`, `favorite`)
- [x] Input validation with clear error messages
- [x] SQLite persistence (WAL mode), in-memory DB for tests
- [x] Consistent JSON error responses
- [x] Tags (many-to-many, normalised, max 10 per snippet) and `GET /tags` usage counts
- [x] Full-text search (SQLite FTS5, BM25 ranking, prefix matching, safe query syntax)
- [x] Filtering by language / favorite / tag(s), sorting and pagination
- [ ] API-key auth, rate limiting, OpenAPI docs, JSON export/import
- [ ] Docker image, CI, v1.0.0

## Tech stack

- Node.js >= 22.5 (uses `node:sqlite`, `node:test`, global `fetch`)
- Express 5
- SQLite

## Getting started

```bash
npm install
npm start          # http://localhost:3000
npm test
```

Environment variables:

| Variable  | Default             | Description              |
|-----------|---------------------|--------------------------|
| `PORT`    | `3000`              | HTTP port                |
| `DB_PATH` | `data/snipvault.db` | SQLite database location |

## API

| Method | Path             | Description                         |
|--------|------------------|-------------------------------------|
| GET    | `/health`        | Liveness check                      |
| POST   | `/snippets`      | Create a snippet (`title`, `code` required) |
| GET    | `/snippets`      | Search, filter, sort and paginate snippets |
| GET    | `/tags`          | List tags with usage counts         |
| GET    | `/snippets/:id`  | Fetch one snippet                   |
| PATCH  | `/snippets/:id`  | Partially update a snippet          |
| DELETE | `/snippets/:id`  | Delete a snippet                    |

### `GET /snippets` query parameters

| Param      | Description                                                              |
|------------|--------------------------------------------------------------------------|
| `q`        | Full-text search over title, description, code and tags (last word is a prefix) |
| `language` | Exact language match, e.g. `python`                                      |
| `favorite` | `true` or `false`                                                        |
| `tag`      | Repeatable or comma-separated; a snippet must have **all** given tags   |
| `sort`     | `created` (default), `updated`, `title`, or `relevance` (default when `q` is set) |
| `order`    | `asc` or `desc` (default)                                                |
| `limit`    | 1-100, default 20                                                        |
| `offset`   | Default 0                                                                |

The response is `{ "data": [...], "total": N, "limit": 20, "offset": 0 }`. Snippets accept an optional
`tags` array (`["utils", "js"]`) on create and update; tags are lower-cased and limited to `a-z 0-9 . _ + -`.

Examples:

```bash
curl "localhost:3000/snippets?q=debounce&language=javascript"
curl "localhost:3000/snippets?tag=utils&tag=js&sort=title&order=asc&limit=10"
```

Create:

```bash
curl -X POST localhost:3000/snippets \
  -H "content-type: application/json" \
  -d '{"title":"Reverse string","language":"js","code":"[...s].reverse().join(\"\")"}'
```

## Project structure

```
src/
  app.js          Express app factory (routes + error handling)
  server.js       Entry point
  db.js           SQLite connection, schema, FTS5 index
  repository.js   Data-access layer (tags, search, filters)
  validate.js     Request + query validation
  errors.js       HttpError class
test/             node:test integration tests (CRUD, tags, search, pagination)
```

## License

MIT © Dans-Vsa
