import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8");
const json = JSON.parse(source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, ""));
const banned = ["kv_namespaces", "r2_buckets", "durable_objects", "queues", "vectorize", "ai", "analytics_engine_datasets", "worker_loaders"];
const found = banned.filter((key) => json[key] && (!Array.isArray(json[key]) || json[key].length > 0));
if (found.length) {
  console.error(`Paid or extra Cloudflare products are configured: ${found.join(", ")}`);
  process.exit(1);
}
if (!json.d1_databases?.some((database) => database.binding === "DB")) {
  console.error("D1 binding DB is missing.");
  process.exit(1);
}
if (!json.assets?.directory) {
  console.error("Static assets directory is missing.");
  process.exit(1);
}
if (json.name !== "mailsentry") {
  console.error("Worker name must stay mailsentry.");
  process.exit(1);
}
if (!json.d1_databases[0].database_id) {
  console.log("Cloudflare config uses only Workers, static assets, and D1. database_id is not set yet.");
} else {
  console.log("Cloudflare config uses only Workers, static assets, and D1.");
}
