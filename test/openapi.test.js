import { test } from "node:test";
import assert from "node:assert/strict";
import { startTestServer } from "./helpers.js";

test("/openapi.json describes every route and resolves its $refs", async () => {
  const srv = await startTestServer();
  try {
    const { status, body } = await srv.request("GET", "/openapi.json");
    assert.equal(status, 200);
    assert.equal(body.openapi, "3.0.3");
    assert.equal(body.info.version, (await srv.request("GET", "/health")).body.version);
    for (const path of ["/health", "/snippets", "/snippets/{id}", "/tags", "/export", "/import"]) {
      assert.ok(body.paths[path], `missing ${path}`);
    }
    const refs = [...JSON.stringify(body).matchAll(/#\/components\/schemas\/(\w+)/g)].map((m) => m[1]);
    for (const name of refs) assert.ok(body.components.schemas[name], `dangling ref ${name}`);
  } finally {
    await srv.close();
  }
});
