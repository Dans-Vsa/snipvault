import { SORTS } from "./validate.js";

const toSnippet = (row, tags = []) =>
  row && {
    id: row.id,
    title: row.title,
    language: row.language,
    code: row.code,
    description: row.description,
    favorite: Boolean(row.favorite),
    tags,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

/**
 * Turn free user text into a safe FTS5 query: every word becomes a quoted
 * term (AND semantics) and the last word is treated as a prefix.
 */
export function toFtsQuery(text) {
  const words = text.match(/[\p{L}\p{N}_]+/gu) ?? [];
  if (words.length === 0) return null;
  return words.map((w, i) => `"${w}"${i === words.length - 1 ? "*" : ""}`).join(" ");
}

/** Data-access layer for snippets and their tags. */
export function createSnippetRepository(db) {
  const insert = db.prepare(
    `INSERT INTO snippets (title, language, code, description, favorite, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const selectOne = db.prepare("SELECT * FROM snippets WHERE id = ?");
  const remove = db.prepare("DELETE FROM snippets WHERE id = ?");
  const update = db.prepare(
    `UPDATE snippets SET title = ?, language = ?, code = ?, description = ?, favorite = ?, updated_at = ?
     WHERE id = ?`,
  );
  const upsertTag = db.prepare("INSERT INTO tags (name) VALUES (?) ON CONFLICT(name) DO NOTHING");
  const tagId = db.prepare("SELECT id FROM tags WHERE name = ?");
  const link = db.prepare("INSERT OR IGNORE INTO snippet_tags (snippet_id, tag_id) VALUES (?, ?)");
  const unlinkAll = db.prepare("DELETE FROM snippet_tags WHERE snippet_id = ?");
  const tagsOf = db.prepare(
    `SELECT t.name FROM tags t JOIN snippet_tags st ON st.tag_id = t.id
     WHERE st.snippet_id = ? ORDER BY t.name`,
  );
  const pruneTags = db.prepare("DELETE FROM tags WHERE id NOT IN (SELECT tag_id FROM snippet_tags)");
  const ftsDelete = db.prepare("DELETE FROM snippets_fts WHERE rowid = ?");
  const ftsInsert = db.prepare(
    "INSERT INTO snippets_fts (rowid, title, description, code, tags) VALUES (?, ?, ?, ?, ?)",
  );

  const transaction = (fn) => {
    db.exec("BEGIN");
    try {
      const result = fn();
      db.exec("COMMIT");
      return result;
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }
  };

  const getTags = (id) => tagsOf.all(id).map((r) => r.name);

  function setTags(id, names) {
    unlinkAll.run(id);
    for (const name of names) {
      upsertTag.run(name);
      link.run(id, tagId.get(name).id);
    }
    pruneTags.run();
  }

  function reindex(id) {
    const row = selectOne.get(id);
    ftsDelete.run(id);
    ftsInsert.run(id, row.title, row.description, row.code, getTags(id).join(" "));
  }

  function insertSnippet(data) {
    const now = new Date().toISOString();
    const res = insert.run(
      data.title,
      data.language ?? "text",
      data.code,
      data.description ?? "",
      data.favorite ? 1 : 0,
      now,
      now,
    );
    const id = Number(res.lastInsertRowid);
    setTags(id, data.tags ?? []);
    reindex(id);
    return id;
  }

  const repo = {
    create(data) {
      const id = transaction(() => insertSnippet(data));
      return repo.get(id);
    },
    /** Every snippet in id order, as plain importable objects. */
    exportAll() {
      return db
        .prepare("SELECT * FROM snippets ORDER BY id")
        .all()
        .map((r) => ({
          title: r.title,
          language: r.language,
          code: r.code,
          description: r.description,
          favorite: Boolean(r.favorite),
          tags: getTags(r.id),
        }));
    },
    /** Insert many snippets atomically; returns how many were created. */
    importMany(items) {
      return transaction(() => {
        for (const item of items) insertSnippet(item);
        return items.length;
      });
    },
    get(id) {
      const row = selectOne.get(id);
      return row ? toSnippet(row, getTags(id)) : null;
    },
    /** Filtered, searchable, sorted and paginated listing. */
    list({ q, language, favorite, tags = [], sort = "created", order = "desc", limit = 20, offset = 0 } = {}) {
      const where = [];
      const params = [];
      let from = "snippets s";
      const match = q ? toFtsQuery(q) : null;
      if (q && !match) return { data: [], total: 0, limit, offset };
      if (match) {
        from += " JOIN snippets_fts f ON f.rowid = s.id";
        where.push("snippets_fts MATCH ?");
        params.push(match);
      }
      if (language) {
        where.push("s.language = ?");
        params.push(language);
      }
      if (favorite !== undefined) {
        where.push("s.favorite = ?");
        params.push(favorite ? 1 : 0);
      }
      for (const tag of tags) {
        where.push(
          `EXISTS (SELECT 1 FROM snippet_tags st JOIN tags t ON t.id = st.tag_id
                   WHERE st.snippet_id = s.id AND t.name = ?)`,
        );
        params.push(tag);
      }
      const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
      const dir = order === "asc" ? "ASC" : "DESC";
      const orderBy =
        sort === "relevance" && match
          ? `ORDER BY bm25(snippets_fts, 10.0, 3.0, 1.0, 5.0), s.id DESC`
          : `ORDER BY s.${SORTS[sort] ?? "created_at"} ${dir}, s.id ${dir}`;

      const total = db.prepare(`SELECT COUNT(*) AS n FROM ${from} ${clause}`).get(...params).n;
      const rows = db
        .prepare(`SELECT s.* FROM ${from} ${clause} ${orderBy} LIMIT ? OFFSET ?`)
        .all(...params, limit, offset);
      return { data: rows.map((r) => toSnippet(r, getTags(r.id))), total, limit, offset };
    },
    update(id, patch) {
      return transaction(() => {
        const current = selectOne.get(id);
        if (!current) return null;
        const favorite = patch.favorite === undefined ? current.favorite : patch.favorite ? 1 : 0;
        update.run(
          patch.title ?? current.title,
          patch.language ?? current.language,
          patch.code ?? current.code,
          patch.description ?? current.description,
          favorite,
          new Date().toISOString(),
          id,
        );
        if (patch.tags) setTags(id, patch.tags);
        reindex(id);
        return repo.get(id);
      });
    },
    delete(id) {
      return transaction(() => {
        ftsDelete.run(id);
        const removed = remove.run(id).changes > 0;
        if (removed) pruneTags.run();
        return removed;
      });
    },
    /** All tags with the number of snippets using each, most used first. */
    listTags() {
      return db
        .prepare(
          `SELECT t.name, COUNT(st.snippet_id) AS count FROM tags t
           JOIN snippet_tags st ON st.tag_id = t.id GROUP BY t.id ORDER BY count DESC, t.name`,
        )
        .all()
        .map((r) => ({ name: r.name, count: r.count }));
    },
  };
  return repo;
}
