import { readFileSync } from "node:fs";

const base = process.argv[2] ?? "http://127.0.0.1:8787";
const vars = Object.fromEntries(
  readFileSync(new URL("../.dev.vars", import.meta.url), "utf8")
    .split("\n")
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index), line.slice(index + 1)];
    }),
);

const origin = new URL(base).origin;
const failures = [];

async function check(name, fn) {
  try {
    await fn();
    console.log(`ok ${name}`);
  } catch (error) {
    failures.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
    console.error(`fail ${name}`);
  }
}

function cookieFrom(response) {
  const raw = response.headers.get("set-cookie") ?? "";
  const match = raw.match(/mailsentry_session=([^;]+)/);
  if (!match) throw new Error("session cookie missing");
  return `mailsentry_session=${match[1]}`;
}

await check("health", async () => {
  const response = await fetch(`${base}/api/health`);
  const body = await response.json();
  if (response.status !== 200 || body.app !== "mailsentry") throw new Error(JSON.stringify(body));
});

await check("anonymous dashboard", async () => {
  const response = await fetch(`${base}/api/dashboard`);
  if (response.status !== 401) throw new Error(String(response.status));
});

let cookie = "";
await check("login", async () => {
  const response = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify({ password: vars.MAILSENTRY_ACCESS_PASSWORD }),
  });
  if (response.status !== 200) throw new Error(await response.text());
  cookie = cookieFrom(response);
});

let analysisId = "";
await check("bank-change upload", async () => {
  const eml = readFileSync(new URL("../fixtures/emails/first_time_bank_change.eml", import.meta.url));
  const form = new FormData();
  form.set("file", new File([eml], "first_time_bank_change.eml", { type: "message/rfc822" }));
  const response = await fetch(`${base}/api/analyses`, { method: "POST", headers: { cookie, origin }, body: form });
  const body = await response.json();
  if (response.status !== 201) throw new Error(JSON.stringify(body));
  if (!body.recommendations?.join(" ").includes("Do not update payment details")) throw new Error("missing recommendation");
  if (JSON.stringify(body).includes("Please update our bank details")) throw new Error("body text was returned");
  analysisId = body.id;
});

await check("history contains analysis", async () => {
  const response = await fetch(`${base}/api/analyses/${analysisId}`, { headers: { cookie } });
  if (response.status !== 200) throw new Error(String(response.status));
});

await check("logout", async () => {
  const response = await fetch(`${base}/api/auth/logout`, { method: "POST", headers: { cookie, origin } });
  if (response.status !== 200) throw new Error(String(response.status));
  const setCookie = response.headers.get("set-cookie");
  if (!setCookie) throw new Error("logout did not set cookie");
  if (!setCookie.includes("Max-Age=0")) throw new Error("logout did not set Max-Age=0");
});

await check("spa shell", async () => {
  const response = await fetch(`${base}/analyses/example`);
  const text = await response.text();
  if (response.status !== 200 || !text.toLowerCase().includes("mailsentry")) throw new Error("deep link did not serve the app shell");
});

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(`smoke passed against ${base}`);
