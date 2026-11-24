# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [1.0.0] - 2026-11-24

### Added
- Snippet CRUD (`title`, `language`, `code`, `description`, `favorite`) with strict input validation.
- Many-to-many tags and `GET /tags` usage counts.
- Full-text search (SQLite FTS5, BM25 ranking, prefix matching), filtering, sorting and pagination.
- API-key authentication (`X-API-Key` / Bearer) and per-IP fixed-window rate limiting.
- OpenAPI 3 spec at `/openapi.json` and Swagger UI at `/docs`.
- JSON export and atomic import.
- `/health` and the OpenAPI spec report the package version.
- Graceful shutdown on `SIGINT` / `SIGTERM`.
- Dockerfile (non-root, healthcheck, volume for the database) and `docker-compose.yml`.
- GitHub Actions CI on Node 22 and 24 plus a Docker smoke test.

## [0.1.0] - 2026-11-21

### Added
- Initial scaffold, SQLite persistence and basic snippet CRUD.
