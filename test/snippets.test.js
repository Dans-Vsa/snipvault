import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startTestServer } from "./helpers.js";

let srv;
before(async () => {
  srv = await startTestServer();
});
after(() => srv.close());

const sample = { title: "Reverse string", language: "JavaScript", code: "[...s].reverse().join('')" };

test("health check", async () => {
  const r = await srv.request("GET", "/health");
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { status: "ok" });
});

test("create + fetch a snippet", async () => {
  const created = await srv.request("POST", "/snippets", sample);
  assert.equal(created.status, 201);
  assert.equal(created.body.language, "javascript");
  assert.equal(created.body.favorite, false);
  const got = await srv.request("GET", `/snippets/${created.body.id}`);
  assert.equal(got.status, 200);
  assert.equal(got.body.title, "Reverse string");
});

test("list returns newest first", async () => {
  await srv.request("POST", "/snippets", { ...sample, title: "second" });
  const r = await srv.request("GET", "/snippets");
  assert.equal(r.status, 200);
  assert.equal(r.body.data[0].title, "second");
});

test("patch updates only given fields", async () => {
  const { body } = await srv.request("POST", "/snippets", sample);
  const r = await srv.request("PATCH", `/snippets/${body.id}`, { favorite: true, description: "handy" });
  assert.equal(r.status, 200);
  assert.equal(r.body.favorite, true);
  assert.equal(r.body.description, "handy");
  assert.equal(r.body.code, sample.code);
});

test("delete removes the snippet", async () => {
  const { body } = await srv.request("POST", "/snippets", sample);
  assert.equal((await srv.request("DELETE", `/snippets/${body.id}`)).status, 204);
  assert.equal((await srv.request("GET", `/snippets/${body.id}`)).status, 404);
  assert.equal((await srv.request("DELETE", `/snippets/${body.id}`)).status, 404);
});

test("validation errors", async () => {
  const missing = await srv.request("POST", "/snippets", { title: "x" });
  assert.equal(missing.status, 400);
  assert.ok(missing.body.details.includes("code is required"));
  const wrongType = await srv.request("POST", "/snippets", { ...sample, favorite: "yes" });
  assert.equal(wrongType.status, 400);
  const empty = await srv.request("PATCH", "/snippets/1", {});
  assert.equal(empty.status, 400);
  const badId = await srv.request("GET", "/snippets/abc");
  assert.equal(badId.status, 400);
});

test("malformed JSON and unknown routes", async () => {
  assert.equal((await srv.request("POST", "/snippets", "{nope")).status, 400);
  assert.equal((await srv.request("GET", "/nothing")).status, 404);
});
