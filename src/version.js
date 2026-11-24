import { readFileSync } from "node:fs";

/** Package version, read once from package.json so the API and the package never drift apart. */
export const VERSION = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
).version;
