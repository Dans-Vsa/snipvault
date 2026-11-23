import { test } from "node:test";
import assert from "node:assert/strict";
import { startTestServer } from "./helpers.js";
import { rateLimit } from "../src/ratelimit.js";

test("requests over the limit get 429 with Retry-After", async () => {
  const srv = await startTestServer({ rateLimitMax: 3, rateLimitWindowMs: 60_000 });
  try {
    for (let i = 0; i < 3; i++) {
      const r = await srv.request("GET", "/health");
      assert.equal(r.status, 200);
      assert.equal(r.headers.get("x-ratelimit-limit"), "3");
      assert.equal(r.headers.get("x-ratelimit-remaining"), String(2 - i));
    }
    const blocked = await srv.request("GET", "/health");
    assert.equal(blocked.status, 429);
    assert.equal(blocked.body.error, "Too many requests");
    assert.ok(Number(blocked.headers.get("retry-after")) > 0);
  } finally {
    await srv.close();
  }
});

test("the window resets after it expires", () => {
  let t = 1000;
  const mw = rateLimit({ max: 1, windowMs: 100, now: () => t });
  const res = { set() {} };
  const run = () => {
    let err;
    mw({ ip: "1.2.3.4" }, res, (e) => (err = e));
    return err;
  };
  assert.equal(run(), undefined);
  assert.equal(run()?.status, 429);
  t += 101;
  assert.equal(run(), undefined);
});

test("limit 0 disables limiting", async () => {
  const srv = await startTestServer({ rateLimitMax: 0 });
  try {
    for (let i = 0; i < 10; i++) assert.equal((await srv.request("GET", "/health")).status, 200);
  } finally {
    await srv.close();
  }
});
