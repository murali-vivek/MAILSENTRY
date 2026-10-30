import { readFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
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

// Upload all test emails
const fixturesDir = join(__dirname, "../fixtures/emails");
const files = await readdir(fixturesDir);
const testFiles = files.filter(f => f.startsWith("test_") && f.endsWith(".eml"));

console.log(`Found ${testFiles.length} test emails\n`);
console.log("=".repeat(80));

for (const file of testFiles) {
  const eml = readFileSync(join(fixturesDir, file));
  const form = new FormData();
  form.set("file", new File([eml], file, { type: "message/rfc822" }));

  console.log(`\n📧 Testing: ${file}`);
  console.log("-".repeat(80));

  try {
    const result = await json("/api/analyses", {
      method: "POST",
      body: form,
    });

    console.log(`Risk Level: ${result.riskLevel} (Score: ${result.riskScore})`);
    console.log(`Context: ${result.contextStatus}`);
    console.log(`Vendor: ${result.vendorMatchStatus}`);

    if (result.findings && result.findings.length > 0) {
      console.log("\nTriggered Findings:");
      result.findings.forEach(f => {
        console.log(`  • ${f.ruleId}: ${f.title} (weight: ${f.weight})`);
        console.log(`    Evidence: ${f.evidence}`);
      });
    } else {
      console.log("\nNo findings triggered");
    }

    console.log(`\nRecommendations:`);
    result.recommendations.forEach(r => console.log(`  • ${r}`));

  } catch (error) {
    console.error(`✗ Error: ${error.message}`);
  }
}

console.log("\n" + "=".repeat(80));
console.log("\nTest complete!");
