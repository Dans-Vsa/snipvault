import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startTestServer } from "./helpers.js";

let srv;
before(async () => {
  srv = await startTestServer({ apiKeys: ["secret-one", "secret-two"] });
});
after(() => srv.close());

test("health and docs stay public", async () => {
  assert.equal((await srv.request("GET", "/health")).status, 200);
  assert.equal((await srv.request("GET", "/openapi.json")).status, 200);
  const docs = await fetch(`http://127.0.0.1:${srv.port}/docs`);
  assert.equal(docs.status, 200);
  assert.match(await docs.text(), /swagger-ui/);
});

test("requests without a key are rejected with 401", async () => {
  const r = await srv.request("GET", "/snippets");
  assert.equal(r.status, 401);
  assert.match(r.body.error, /API key required/);
});

test("a wrong key is rejected", async () => {
  const r = await srv.request("GET", "/snippets", undefined, { "x-api-key": "nope" });
  assert.equal(r.status, 401);
  assert.equal(r.body.error, "Invalid API key");
});

test("X-API-Key and Bearer tokens both work, for any configured key", async () => {
  assert.equal((await srv.request("GET", "/snippets", undefined, { "x-api-key": "secret-one" })).status, 200);
  assert.equal((await srv.request("GET", "/snippets", undefined, { authorization: "Bearer secret-two" })).status, 200);
});

test("write routes and export/import are protected too", async () => {
  assert.equal((await srv.request("POST", "/snippets", { title: "t", code: "c" })).status, 401);
  assert.equal((await srv.request("GET", "/export")).status, 401);
  assert.equal((await srv.request("POST", "/import", { snippets: [] })).status, 401);
});
