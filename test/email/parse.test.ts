import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { parseEmailBytes, EmailParseError } from "../../src/worker/email/parse";
import { normalizeEmail } from "../../src/worker/email/normalize";

function load(name: string): Uint8Array {
  return new Uint8Array(readFileSync(new URL(`../../fixtures/emails/${name}`, import.meta.url)));
}

describe("email parsing", () => {
  it("parses a plain-text invoice", async () => {
    const message = normalizeEmail(await parseEmailBytes(load("normal_invoice.eml")));
    expect(message.fromAddress).toBe("billing@northwind.example");
    expect(message.senderDomain).toBe("northwind.example");
    expect(message.subject).toBe("Invoice NW-1042");
    expect(message.toAddresses).toEqual(["accounts@acme-pay.example"]);
    expect(message.authentication.spf).toBe("pass");
    expect(message.observedSourceIps).toContain("192.0.2.10");
    expect(message.requestCategories).toContain("invoice");
  });

  it("decodes an encoded subject and keeps addresses normalized", async () => {
    const raw = new TextEncoder().encode(
      "From: =?utf-8?Q?Northwind?= <Billing@Northwind.example>\r\nSubject: =?utf-8?Q?Invoice_NW-200?=\r\nContent-Type: text/plain\r\n\r\nPlease see the invoice.\r\n",
    );
    const message = normalizeEmail(await parseEmailBytes(raw));
    expect(message.fromAddress).toBe("billing@northwind.example");
    expect(message.subject).toContain("Invoice");
  });

  it("strips hostile HTML and does not fetch links", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("fetch was called"));
    const message = normalizeEmail(await parseEmailBytes(load("hostile_html.eml")));
    expect(message.bodyHtmlPresent).toBe(true);
    expect(message.bodyText).not.toContain("pwned-script");
    expect(message.bodyText).toContain("Invoice NW-9");
    expect(message.linkHosts).toContain("pay-now.example");
    expect(message.linkHosts).toContain("images.example");
    expect(JSON.stringify(message.linkHosts)).not.toContain("account=");
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("rejects malformed input", async () => {
    await expect(parseEmailBytes(load("malformed_email.eml"))).rejects.toBeInstanceOf(EmailParseError);
  });

  it("rejects too many MIME parts and deep nesting", async () => {
    const parts = Array.from({ length: 31 }, (_, index) => `Content-Type: text/plain\r\n\r\npart ${index}`).join("\r\n");
    const wide = new TextEncoder().encode(`From: a@northwind.example\r\nSubject: wide\r\n${parts}`);
    await expect(parseEmailBytes(wide)).rejects.toBeInstanceOf(EmailParseError);
    let nested = "From: a@northwind.example\r\n";
    for (let depth = 0; depth < 9; depth += 1) {
      nested += `Content-Type: multipart/mixed; boundary="b${depth}"\r\n\r\n--b${depth}\r\n`;
    }
    await expect(parseEmailBytes(new TextEncoder().encode(nested))).rejects.toBeInstanceOf(EmailParseError);
  });

  it("bounds a large plain-text body and finishes quickly", async () => {
    const body = "A".repeat(180 * 1024);
    const raw = new TextEncoder().encode(`From: a@northwind.example\r\nSubject: big\r\nContent-Type: text/plain\r\n\r\n${body}`);
    const started = performance.now();
    const message = normalizeEmail(await parseEmailBytes(raw));
    const elapsed = performance.now() - started;
    expect(message.bodyText.length).toBeLessThanOrEqual(100 * 1024);
    expect(elapsed).toBeLessThan(500);
  });
});
