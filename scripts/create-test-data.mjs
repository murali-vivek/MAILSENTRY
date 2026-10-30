import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BASE_URL = "https://mailsentry.red-unit-6971.workers.dev";
const vars = Object.fromEntries(
  readFileSync(join(__dirname, "../.dev.vars"), "utf8")
    .split("\n")
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index), line.slice(index + 1)];
    }),
);

let cookie = "";

async function api(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const headers = new Headers(options.headers || {});
  if (cookie) headers.set("cookie", cookie);
  if (options.method && options.method !== "GET") headers.set("origin", BASE_URL);
  const response = await fetch(url, { ...options, headers });
  const setCookie = response.headers.get("set-cookie");
  if (setCookie) {
    const match = setCookie.match(/mailsentry_session=([^;]+)/);
    if (match) cookie = `mailsentry_session=${match[1]}`;
  }
  return response;
}

async function json(path, options = {}) {
  const response = await api(path, options);
  const body = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(body));
  return body;
}

// Login
console.log("Logging in...");
await json("/api/auth/login", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ password: vars.MAILSENTRY_ACCESS_PASSWORD }),
});
console.log("✓ Logged in");

// Create TechCorp vendor
console.log("\nCreating TechCorp vendor...");
const techcorp = await json("/api/vendors", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    displayName: "TechCorp Services",
    canonicalDomain: "techcorp.example",
    senderAddresses: ["billing@techcorp.example", "support@techcorp.example"],
    domains: ["techcorp.example"],
    internalRecipients: ["accounts@yourcompany.example", "finance@yourcompany.example"],
  }),
});
console.log("✓ Created TechCorp vendor:", techcorp.id);

// Create NorthWind vendor
console.log("\nCreating NorthWind vendor...");
const northwind = await json("/api/vendors", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    displayName: "NorthWind Supplies",
    canonicalDomain: "northwind.example",
    senderAddresses: ["billing@northwind.example", "orders@northwind.example"],
    domains: ["northwind.example"],
    internalRecipients: ["accounts@yourcompany.example"],
  }),
});
console.log("✓ Created NorthWind vendor:", northwind.id);

console.log("\n=== Vendor IDs ===");
console.log("TechCorp:", techcorp.id);
console.log("NorthWind:", northwind.id);
