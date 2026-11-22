import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startTestServer } from "./helpers.js";
import { toFtsQuery } from "../src/repository.js";

let srv;
const ids = {};

before(async () => {
  srv = await startTestServer();
  const seed = [
    { key: "debounce", title: "Debounce function", language: "javascript", code: "function debounce(fn, ms) {}", tags: ["utils", "js"], favorite: true },
    { key: "flatten", title: "Flatten nested list", language: "python", code: "def flatten(xs): ...", description: "Recursive flatten", tags: ["utils", "lists"] },
    { key: "sql", title: "Top customers", language: "sql", code: "SELECT * FROM customers ORDER BY total DESC", tags: ["reports"] },
    { key: "css", title: "Center a div", language: "css", code: "display: grid; place-items: center;", tags: ["layout"], favorite: true },
  ];
  for (const s of seed) {
    const { key, ...body } = s;
    ids[key] = (await srv.request("POST", "/snippets", body)).body.id;
  }
});
after(() => srv.close());

const titles = (r) => r.body.data.map((s) => s.title);

test("tags are normalised, deduplicated and returned sorted", async () => {
  const r = await srv.request("POST", "/snippets", { title: "t", code: "c", tags: [" Foo ", "foo", "Bar"] });
  assert.equal(r.status, 201);
  assert.deepEqual(r.body.tags, ["bar", "foo"]);
});

test("invalid tags are rejected", async () => {
  const r = await srv.request("POST", "/snippets", { title: "t", code: "c", tags: ["ok", "no spaces"] });
  assert.equal(r.status, 400);
  assert.match(r.body.details[0], /invalid tag/);
  assert.equal((await srv.request("POST", "/snippets", { title: "t", code: "c", tags: "x" })).status, 400);
  const many = Array.from({ length: 11 }, (_, i) => `t${i}`);
  assert.equal((await srv.request("POST", "/snippets", { title: "t", code: "c", tags: many })).status, 400);
});

test("PATCH replaces tags and prunes unused ones", async () => {
  const { body } = await srv.request("POST", "/snippets", { title: "p", code: "c", tags: ["temp-only"] });
  const r = await srv.request("PATCH", `/snippets/${body.id}`, { tags: ["kept"] });
  assert.deepEqual(r.body.tags, ["kept"]);
  const tags = (await srv.request("GET", "/tags")).body.data.map((t) => t.name);
  assert.ok(tags.includes("kept"));
  assert.ok(!tags.includes("temp-only"));
});

test("GET /tags counts usage, most used first", async () => {
  const { body } = await srv.request("GET", "/tags");
  const utils = body.data.find((t) => t.name === "utils");
  assert.equal(utils.count, 2);
  assert.equal(body.data[0].name, "utils");
});

test("filter by tag, language and favorite", async () => {
  assert.deepEqual(titles(await srv.request("GET", "/snippets?tag=lists")), ["Flatten nested list"]);
  assert.deepEqual(titles(await srv.request("GET", "/snippets?language=SQL")), ["Top customers"]);
  const fav = await srv.request("GET", "/snippets?favorite=true&sort=title&order=asc");
  assert.deepEqual(titles(fav).filter((t) => ["Center a div", "Debounce function"].includes(t)), [
    "Center a div",
    "Debounce function",
  ]);
  assert.ok(fav.body.data.every((s) => s.favorite));
});

test("multiple tag filters use AND semantics", async () => {
  assert.deepEqual(titles(await srv.request("GET", "/snippets?tag=utils&tag=js")), ["Debounce function"]);
  assert.deepEqual(titles(await srv.request("GET", "/snippets?tag=utils,lists")), ["Flatten nested list"]);
  assert.equal((await srv.request("GET", "/snippets?tag=utils&tag=reports")).body.total, 0);
});

test("full-text search covers title, code, description and tags", async () => {
  assert.deepEqual(titles(await srv.request("GET", "/snippets?q=debounce")), ["Debounce function"]);
  assert.deepEqual(titles(await srv.request("GET", "/snippets?q=customers")), ["Top customers"]);
  assert.deepEqual(titles(await srv.request("GET", "/snippets?q=recursive")), ["Flatten nested list"]);
  assert.deepEqual(titles(await srv.request("GET", "/snippets?q=layout")), ["Center a div"]);
});

test("search supports prefixes and ignores FTS syntax characters", async () => {
  assert.deepEqual(titles(await srv.request("GET", "/snippets?q=deb")), ["Debounce function"]);
  const r = await srv.request("GET", `/snippets?q=${encodeURIComponent('"(*) AND OR NEAR')}`);
  assert.equal(r.status, 200);
  assert.equal((await srv.request("GET", "/snippets?q=%22%22")).body.total, 0);
});

test("search can be combined with filters", async () => {
  assert.equal((await srv.request("GET", "/snippets?q=flatten&language=python")).body.total, 1);
  assert.equal((await srv.request("GET", "/snippets?q=flatten&language=sql")).body.total, 0);
});

test("search index follows updates and deletes", async () => {
  await srv.request("PATCH", `/snippets/${ids.sql}`, { title: "Revenue ranking" });
  assert.equal((await srv.request("GET", "/snippets?q=top")).body.total, 0);
  assert.equal((await srv.request("GET", "/snippets?q=revenue")).body.total, 1);
  await srv.request("DELETE", `/snippets/${ids.sql}`);
  assert.equal((await srv.request("GET", "/snippets?q=revenue")).body.total, 0);
});

test("pagination returns total, limit and offset", async () => {
  const page1 = await srv.request("GET", "/snippets?limit=2&sort=title&order=asc");
  const page2 = await srv.request("GET", "/snippets?limit=2&offset=2&sort=title&order=asc");
  assert.equal(page1.body.data.length, 2);
  assert.equal(page1.body.limit, 2);
  assert.ok(page1.body.total >= 4);
  assert.notEqual(page1.body.data[0].id, page2.body.data[0].id);
  assert.equal(page2.body.offset, 2);
});

test("invalid query parameters give 400", async () => {
  for (const qs of ["limit=0", "limit=101", "offset=-1", "sort=bogus", "order=up", "favorite=maybe", "sort=relevance"]) {
    const r = await srv.request("GET", `/snippets?${qs}`);
    assert.equal(r.status, 400, qs);
  }
});

test("toFtsQuery quotes words and prefixes the last one", () => {
  assert.equal(toFtsQuery("hello world"), '"hello" "world"*');
  assert.equal(toFtsQuery('a"b'), '"a" "b"*');
  assert.equal(toFtsQuery("***"), null);
});
