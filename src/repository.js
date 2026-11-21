const toSnippet = (row) =>
  row && {
    id: row.id,
    title: row.title,
    language: row.language,
    code: row.code,
    description: row.description,
    favorite: Boolean(row.favorite),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

/** Data-access layer for snippets. */
export function createSnippetRepository(db) {
  const insert = db.prepare(
    `INSERT INTO snippets (title, language, code, description, favorite, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const selectOne = db.prepare("SELECT * FROM snippets WHERE id = ?");
  const selectAll = db.prepare("SELECT * FROM snippets ORDER BY id DESC");
  const remove = db.prepare("DELETE FROM snippets WHERE id = ?");
  const update = db.prepare(
    `UPDATE snippets SET title = ?, language = ?, code = ?, description = ?, favorite = ?, updated_at = ?
     WHERE id = ?`,
  );

  return {
    create(data) {
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
      return this.get(Number(res.lastInsertRowid));
    },
    get(id) {
      return toSnippet(selectOne.get(id));
    },
    list() {
      return selectAll.all().map(toSnippet);
    },
    update(id, patch) {
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
      return this.get(id);
    },
    delete(id) {
      return remove.run(id).changes > 0;
    },
  };
}
