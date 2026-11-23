import { createApp } from "../src/app.js";
import { openDb } from "../src/db.js";

/** Start an app on an ephemeral port with an in-memory DB. */
export async function startTestServer(options = {}) {
  const app = createApp(openDb(":memory:"), options);
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = async (method, path, body, headers = {}) => {
    const res = await fetch(base + path, {
      method,
      headers: body === undefined ? { ...headers } : { "content-type": "application/json", ...headers },
      body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
    });
    const text = await res.text();
    return { status: res.status, headers: res.headers, body: text ? JSON.parse(text) : null };
  };
  return { port: server.address().port, request, close: () => new Promise((r) => server.close(r)) };
}
