import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startTestServer } from "./helpers.js";

let srv;
before(async () => {
  srv = await startTestServer();
});
after(() => srv.close());

test("export returns every snippet in importable form", async () => {
  await srv.request("POST", "/snippets", { title: "A", code: "a()", tags: ["x", "y"], favorite: true });
  await srv.request("POST", "/snippets", { title: "B", code: "b()", language: "go" });
  const r = await srv.request("GET", "/export");
  assert.equal(r.status, 200);
  assert.equal(r.body.version, 1);
  assert.match(r.headers.get("content-disposition"), /attachment/);
  assert.equal(r.body.snippets.length, 2);
  assert.deepEqual(r.body.snippets[0], {
    title: "A", language: "text", code: "a()", description: "", favorite: true, tags: ["x", "y"],
  });
});

test("an export can be imported into a fresh server (round trip)", async () => {
  const exported = (await srv.request("GET", "/export")).body;
  const other = await startTestServer();
  try {
    const r = await other.request("POST", "/import", exported);
    assert.deepEqual(r.body, { imported: 2 });
    const list = await other.request("GET", "/snippets?sort=title&order=asc");
    assert.deepEqual(list.body.data.map((s) => s.title), ["A", "B"]);
    assert.deepEqual((await other.request("GET", "/tags")).body.data.map((t) => t.name).sort(), ["x", "y"]);
    // imported snippets are searchable
    assert.equal((await other.request("GET", "/snippets?q=b")).body.total, 1);
  } finally {
    await other.close();
  }
});

test("import is atomic: one invalid snippet imports nothing", async () => {
  const before = (await srv.request("GET", "/snippets")).body.total;
  const r = await srv.request("POST", "/import", {
    snippets: [{ title: "ok", code: "1" }, { title: "", code: "2" }, { code: "3" }],
  });
  assert.equal(r.status, 400);
  assert.ok(r.body.details.some((d) => d.startsWith("snippets[1]")));
  assert.ok(r.body.details.some((d) => d.startsWith("snippets[2]")));
  assert.equal((await srv.request("GET", "/snippets")).body.total, before);
});

test("import rejects malformed bodies", async () => {
  assert.equal((await srv.request("POST", "/import", { nope: 1 })).status, 400);
  assert.equal((await srv.request("POST", "/import", [])).status, 400);
});
