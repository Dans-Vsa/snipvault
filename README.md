# snipvault

A tiny self-hosted REST API for storing, tagging and searching code snippets.
Built with Node.js, Express 5 and the built-in `node:sqlite` module — a single runtime dependency, no native compilation.

> Status: **work in progress** (milestone 1 of 4).

## Features

- [x] Create / read / update / delete snippets (`title`, `language`, `code`, `description`, `favorite`)
- [x] Input validation with clear error messages
- [x] SQLite persistence (WAL mode), in-memory DB for tests
- [x] Consistent JSON error responses
- [ ] Tags, full-text search (SQLite FTS5), filtering, pagination
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
| GET    | `/snippets`      | List snippets, newest first         |
| GET    | `/snippets/:id`  | Fetch one snippet                   |
| PATCH  | `/snippets/:id`  | Partially update a snippet          |
| DELETE | `/snippets/:id`  | Delete a snippet                    |

Example:

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
  db.js           SQLite connection and schema
  repository.js   Data-access layer
  validate.js     Request validation
  errors.js       HttpError class
test/             node:test integration tests
```

## License

MIT © Dans-Vsa
