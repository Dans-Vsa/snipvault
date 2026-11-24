# snipvault

A tiny self-hosted REST API for storing, tagging and searching code snippets.
Built with Node.js, Express 5 and the built-in `node:sqlite` module — a single runtime dependency, no native compilation.

[![CI](https://github.com/Dans-Vsa/snipvault/actions/workflows/ci.yml/badge.svg)](https://github.com/Dans-Vsa/snipvault/actions/workflows/ci.yml)

> Status: **v1.0.0** - feature complete. See the [changelog](CHANGELOG.md).

## Features

- [x] Create / read / update / delete snippets (`title`, `language`, `code`, `description`, `favorite`)
- [x] Input validation with clear error messages
- [x] SQLite persistence (WAL mode), in-memory DB for tests
- [x] Consistent JSON error responses
- [x] Tags (many-to-many, normalised, max 10 per snippet) and `GET /tags` usage counts
- [x] Full-text search (SQLite FTS5, BM25 ranking, prefix matching, safe query syntax)
- [x] Filtering by language / favorite / tag(s), sorting and pagination
- [x] API-key auth (`X-API-Key` / Bearer, constant-time compare), per-IP rate limiting
- [x] OpenAPI 3 spec (`/openapi.json`) and Swagger UI (`/docs`)
- [x] JSON export / atomic import
- [x] Docker image, docker-compose, GitHub Actions CI (Node 22/24), graceful shutdown
- [x] v1.0.0

## Docker

```bash
docker build -t snipvault .
docker run -d -p 3000:3000 -e API_KEYS=change-me -v snipvault-data:/data snipvault
# or
API_KEYS=change-me docker compose up -d
```

The database lives in the `/data` volume; the container runs as an unprivileged user and has a built-in healthcheck.

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
| `API_KEYS` | _(empty)_          | Comma-separated accepted API keys. Empty = auth disabled (a warning is printed) |
| `RATE_LIMIT_MAX` | `100`        | Requests per window per IP; `0` disables limiting |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Rate-limit window length in ms |

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
| GET    | `/export`        | Download all snippets as JSON       |
| POST   | `/import`        | Import an export document (atomic, max 1000) |
| GET    | `/openapi.json`  | OpenAPI 3 description (public)      |
| GET    | `/docs`          | Swagger UI (public)                 |

### Authentication and rate limiting

Set `API_KEYS=key1,key2` and send a key with every request (except `/health`, `/docs`, `/openapi.json`):

```bash
API_KEYS=s3cret npm start
curl -H "X-API-Key: s3cret" localhost:3000/snippets
curl -H "Authorization: Bearer s3cret" localhost:3000/export > backup.json
```

Responses carry `X-RateLimit-Limit`, `X-RateLimit-Remaining` and `X-RateLimit-Reset`; once exceeded the API
answers `429` with `Retry-After`. The limiter is in-memory and per process; it runs before auth so key guessing is throttled.

### Backup and restore

```bash
curl -H "X-API-Key: s3cret" localhost:3000/export > backup.json
curl -X POST -H "X-API-Key: s3cret" -H "content-type: application/json" --data-binary @backup.json localhost:3000/import
```

Import validates every snippet first and inserts all of them in one transaction (nothing is imported on error).

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
  auth.js         API-key middleware
  ratelimit.js    Fixed-window rate limiter
  openapi.js      OpenAPI spec + docs page
  errors.js       HttpError class
  version.js      Package version helper
Dockerfile, docker-compose.yml   Container setup
.github/workflows/ci.yml        CI pipeline
CHANGELOG.md
test/             node:test integration tests (CRUD, tags, search, auth, rate limit, export/import, OpenAPI)
```

## License

MIT © Dans-Vsa
