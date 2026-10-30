import { env, exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { signSession } from "../../src/worker/middleware/auth";

const origin = "https://mailsentry.test";
const worker = exports.default as { fetch: (request: Request) => Promise<Response> };

async function call(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (init.method && init.method !== "GET" && !headers.has("origin")) headers.set("origin", origin);
  return worker.fetch(new Request(`${origin}${path}`, { ...init, headers }));
}

async function login(password = env.MAILSENTRY_ACCESS_PASSWORD): Promise<string> {
  const response = await call("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password }),
  });
  expect(response.status).toBe(200);
  const cookie = response.headers.get("set-cookie") ?? "";
  const match = cookie.match(/mailsentry_session=([^;]+)/);
  expect(match?.[1]).toBeTruthy();
  return `mailsentry_session=${match?.[1]}`;
}

describe("worker API", () => {
  it("serves health and rejects anonymous data routes", async () => {
    const health = await call("/api/health");
    expect(await health.json()).toEqual({ status: "ok", app: "mailsentry" });
    const dashboard = await call("/api/dashboard");
    expect(dashboard.status).toBe(401);
  });

  it("logs in, rejects a bad password, and logs out", async () => {
    const failed = await call("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: "wrong-password-value" }),
    });
    expect(failed.status).toBe(401);
    const cookie = await login();
    const session = await call("/api/auth/session", { headers: { cookie } });
    expect(session.status).toBe(200);
    const expired = await signSession(env.MAILSENTRY_SESSION_SECRET, Date.now() - 13 * 60 * 60 * 1000);
    const stale = await call("/api/auth/session", { headers: { cookie: `mailsentry_session=${expired}` } });
    expect(stale.status).toBe(401);
    const tampered = await call("/api/auth/session", { headers: { cookie: `${cookie}x` } });
    expect(tampered.status).toBe(401);
    const loggedOut = await call("/api/auth/logout", { method: "POST", headers: { cookie } });
    expect(loggedOut.status).toBe(200);
    const cleared = loggedOut.headers.get("set-cookie") ?? "";
    const after = await call("/api/dashboard", { headers: { cookie: cleared.split(";")[0] ?? "" } });
    expect(after.status).toBe(401);
  });

  it("rejects cross-origin mutations", async () => {
    const response = await call("/api/auth/login", {
      method: "POST",
      headers: { origin: "https://evil.example", "content-type": "application/json" },
      body: JSON.stringify({ password: env.MAILSENTRY_ACCESS_PASSWORD }),
    });
    expect(response.status).toBe(403);
  });

  it("analyzes an upload, reviews it, and guards vendor history", async () => {
    const cookie = await login();
    const created = await call("/api/vendors", {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({
        displayName: "Northwind Supplies",
        canonicalDomain: "northwind.example",
        senderAddresses: ["billing@northwind.example"],
        domains: ["northwind.example"],
        internalRecipients: ["accounts@acme-pay.example"],
      }),
    });
    expect(created.status).toBe(201);
    const bank = await upload(cookie, "first_time_bank_change.eml", bankMessage);
    expect(bank.status).toBe(201);
    const bankBody = await bank.json() as AnalysisResponse;
    expect(bankBody.riskLevel).toBe("high");
    expect(bankBody.recommendations.join(" ")).toContain("Do not update payment details");
    expect(bankBody.findings.some((finding) => finding.ruleId === "BANK_CHANGE_REQUEST")).toBe(true);
    expect(JSON.stringify(bankBody)).not.toContain("synthetic example only");
    const rejected = await call(`/api/analyses/${bankBody.id}/add-to-vendor-history`, {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ confirm: true }),
    });
    expect(rejected.status).toBe(409);

    const invoice = await upload(cookie, "normal_invoice.eml", invoiceMessage);
    const invoiceBody = await invoice.json() as AnalysisResponse;
    const reviewed = await call(`/api/analyses/${invoiceBody.id}/review`, {
      method: "PATCH",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ status: "benign_after_review", note: "Called the number on file." }),
    });
    expect(reviewed.status).toBe(200);
    const added = await call(`/api/analyses/${invoiceBody.id}/add-to-vendor-history`, {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ confirm: true }),
    });
    expect(added.status).toBe(200);
    const again = await call(`/api/analyses/${invoiceBody.id}/add-to-vendor-history`, {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ confirm: true }),
    });
    expect(again.status).toBe(200);

    const list = await call("/api/analyses?riskLevel=high", { headers: { cookie } });
    const listed = await list.json() as { items: Array<{ id: string }>; total: number };
    expect(listed.items.some((item) => item.id === bankBody.id)).toBe(true);
    const rows = await env.DB.prepare("SELECT subject, summary, authentication_results FROM email_analyses").all();
    expect(JSON.stringify(rows.results)).not.toContain("Please update our bank details");
    expect(JSON.stringify(rows.results)).not.toContain("Please see the invoice");
  });

  it("keeps user records when demo data is reset", async () => {
    const cookie = await login();
    const userVendor = await call("/api/vendors", {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ displayName: "User Vendor", senderAddresses: ["ap@user-vendor.example"], domains: ["user-vendor.example"], internalRecipients: [] }),
    });
    const userBody = await userVendor.json() as { id: string };
    const seeded = await call("/api/demo/seed", { method: "POST", headers: { cookie } });
    expect(seeded.status).toBe(201);
    const again = await call("/api/demo/seed", { method: "POST", headers: { cookie } });
    expect(again.status).toBe(409);
    const reset = await call("/api/demo/reset", {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ confirm: true }),
    });
    expect(reset.status).toBe(200);
    const vendors = await call("/api/vendors", { headers: { cookie } });
    const vendorBody = await vendors.json() as { items: Array<{ id: string; isDemo: boolean }> };
    expect(vendorBody.items.map((item) => item.id)).toEqual([userBody.id]);
    expect(vendorBody.items[0]?.isDemo).toBe(false);
  });

  it("returns a parse error for a malformed upload and 413 for an oversized file", async () => {
    const cookie = await login();
    const malformed = await upload(cookie, "malformed_email.eml", "this file is not an email and has no headers");
    expect(malformed.status).toBe(400);
    const huge = new File([new Uint8Array(512 * 1024 + 1)], "big.eml");
    const form = new FormData();
    form.set("file", huge);
    const response = await call("/api/analyses", { method: "POST", headers: { cookie }, body: form });
    expect(response.status).toBe(413);
  });
});

type AnalysisResponse = {
  id: string;
  riskLevel: string;
  recommendations: string[];
  findings: Array<{ ruleId: string }>;
};

const invoiceMessage = `From: Northwind Supplies Billing <billing@northwind.example>
To: accounts@acme-pay.example
Subject: Invoice NW-1042
Date: Tue, 15 Oct 2024 15:00:00 +0000
Content-Type: text/plain; charset=utf-8
Authentication-Results: mx.acme-pay.example; spf=pass; dkim=pass; dmarc=pass

Please see the invoice. The amount due is listed in the statement of account.
`;

const bankMessage = `From: Northwind Supplies Billing <billing@northwind.example>
To: accounts@acme-pay.example
Subject: Updated bank details
Date: Tue, 15 Oct 2024 15:00:00 +0000
Content-Type: text/plain; charset=utf-8
Authentication-Results: mx.acme-pay.example; spf=pass; dkim=pass; dmarc=pass

Please update our bank details before the next payment cycle.
`;

function upload(cookie: string, filename: string, contents: string): Promise<Response> {
  const form = new FormData();
  form.set("file", new File([contents], filename, { type: "message/rfc822" }));
  return call("/api/analyses", { method: "POST", headers: { cookie }, body: form });
}
