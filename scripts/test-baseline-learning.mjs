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
console.log("✓ Logged in\n");

// Upload a normal invoice from a known sender
console.log("Step 1: Upload normal invoice from known sender...");
const normalInvoice = readFileSync(join(__dirname, "../fixtures/emails/normal_invoice.eml"));
const form1 = new FormData();
form1.set("file", new File([normalInvoice], "normal_invoice.eml", { type: "message/rfc822" }));
const analysis1 = await json("/api/analyses", { method: "POST", body: form1 });
console.log(`Analysis ID: ${analysis1.id}`);
console.log(`Risk: ${analysis1.riskLevel} (${analysis1.riskScore})`);
console.log(`Vendor: ${analysis1.vendorMatchStatus}`);

// Review as benign
console.log("\nStep 2: Mark as benign after review...");
await json(`/api/analyses/${analysis1.id}/review`, {
  method: "PATCH",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ status: "benign_after_review", note: "Verified with vendor" }),
});
console.log("✓ Reviewed as benign");

// Add to vendor history
console.log("\nStep 3: Add to vendor history...");
const history1 = await json(`/api/analyses/${analysis1.id}/add-to-vendor-history`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ confirm: true }),
});
console.log(`✓ Added to history. Baseline status: ${history1.baselineStatus}`);

// Check vendor baseline
console.log("\nStep 4: Check vendor baseline status...");
const vendors = await json("/api/vendors");
const northwind = vendors.items.find(v => v.displayName === "NorthWind Supplies");
console.log(`NorthWind baseline: ${northwind.baselineStatus} (${northwind.historyEmailCount} observations)`);

// Upload another normal invoice
console.log("\nStep 5: Upload another normal invoice...");
const normalInvoice2 = readFileSync(join(__dirname, "../fixtures/emails/normal_invoice.eml"));
const form2 = new FormData();
form2.set("file", new File([normalInvoice2], "normal_invoice2.eml", { type: "message/rfc822" }));
const analysis2 = await json("/api/analyses", { method: "POST", body: form2 });
console.log(`Analysis ID: ${analysis2.id}`);
console.log(`Risk: ${analysis2.riskLevel} (${analysis2.riskScore})`);

// Review and add to history
await json(`/api/analyses/${analysis2.id}/review`, {
  method: "PATCH",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ status: "benign_after_review", note: "Verified" }),
});
await json(`/api/analyses/${analysis2.id}/add-to-vendor-history`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ confirm: true }),
});
console.log("✓ Added to history");

// Check baseline again
console.log("\nStep 6: Check baseline after 2 observations...");
const vendors2 = await json("/api/vendors");
const northwind2 = vendors2.items.find(v => v.displayName === "NorthWind Supplies");
console.log(`NorthWind baseline: ${northwind2.baselineStatus} (${northwind2.historyEmailCount} observations)`);

// Try to add bank change to history (should fail)
console.log("\nStep 7: Try to add bank change to history (should fail)...");
const bankChange = readFileSync(join(__dirname, "../fixtures/emails/first_time_bank_change.eml"));
const form3 = new FormData();
form3.set("file", new File([bankChange], "bank_change.eml", { type: "message/rfc822" }));
const analysis3 = await json("/api/analyses", { method: "POST", body: form3 });
console.log(`Analysis ID: ${analysis3.id}`);
console.log(`Risk: ${analysis3.riskLevel} (${analysis3.riskScore})`);

await json(`/api/analyses/${analysis3.id}/review`, {
  method: "PATCH",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ status: "benign_after_review", note: "Still risky" }),
});

try {
  await json(`/api/analyses/${analysis3.id}/add-to-vendor-history`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ confirm: true }),
  });
  console.log("✗ Should have failed!");
} catch (error) {
  const err = JSON.parse(error.message);
  console.log(`✓ Correctly rejected: ${err.error.code} - ${err.error.message}`);
}

console.log("\n" + "=".repeat(80));
console.log("Baseline learning test complete!");
