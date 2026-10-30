import { describe, expect, it } from "vitest";
import { BANK_CHANGE_RECOMMENDATION } from "../../src/shared/constants";
import type { BaselineSnapshot, NormalizedMessage, VendorDirectoryEntry } from "../../src/shared/types";
import { evaluateMessage } from "../../src/worker/detection/engine";
import { riskLevelForScore, scoreFindings } from "../../src/worker/detection/score";
import { makeFinding } from "../../src/worker/detection/finding";
import { ruleById } from "../../src/worker/detection/rules";
import { toPublicError } from "../../src/worker/middleware/errors";
import { logRequest } from "../../src/worker/middleware/security";

const vendor: VendorDirectoryEntry = {
  id: "v1",
  displayName: "Northwind Supplies",
  canonicalDomain: "northwind.example",
  senderAddresses: ["billing@northwind.example"],
  domains: ["northwind.example"],
  internalRecipients: ["accounts@acme-pay.example"],
};

function message(overrides: Partial<NormalizedMessage> = {}): NormalizedMessage {
  return {
    fromAddress: "billing@northwind.example",
    fromDisplayName: "Northwind Supplies",
    senderDomain: "northwind.example",
    replyToAddresses: [],
    toAddresses: ["accounts@acme-pay.example"],
    ccAddresses: [],
    subject: "Invoice NW-1042",
    messageId: "<id@northwind.example>",
    receivedAt: "2024-10-15T15:00:00.000Z",
    bodyText: "Please see the invoice. The amount due is listed in the statement of account.",
    bodyHtmlPresent: false,
    linkHosts: [],
    observedSourceIps: ["192.0.2.10"],
    authentication: { spf: "pass", dkim: "pass", dmarc: "pass", usable: true, sawHeader: true },
    requestCategories: ["invoice"],
    ...overrides,
  };
}

function baseline(overrides: Partial<BaselineSnapshot> = {}): BaselineSnapshot {
  return {
    matchStatus: "matched",
    matchedBy: "address",
    vendor,
    maturity: "established",
    observations: Array.from({ length: 5 }, () => ({
      senderAddress: "billing@northwind.example",
      senderDomain: "northwind.example",
      recipients: ["accounts@acme-pay.example"],
      categories: ["invoice"],
      sourceIps: ["192.0.2.10"],
      hourOfDay: 15,
      dayOfWeek: 2,
      isBankChangeRequest: false,
    })),
    directory: [{ id: vendor.id, displayName: vendor.displayName, domains: vendor.domains }],
    ...overrides,
  };
}

function triggered(result: ReturnType<typeof evaluateMessage>, id: string): boolean {
  return result.findings.some((finding) => finding.ruleId === id && finding.status === "triggered");
}

describe("detection engine", () => {
  it("scores boundaries at 19, 20, 39, 40, and 100", () => {
    const rule = ruleById("PAYMENT_URGENCY");
    if (!rule) throw new Error("missing rule");
    expect(riskLevelForScore(0)).toBe("low");
    expect(riskLevelForScore(19)).toBe("low");
    expect(riskLevelForScore(20)).toBe("medium");
    expect(riskLevelForScore(39)).toBe("medium");
    expect(riskLevelForScore(40)).toBe("high");
    const heavy = Array.from({ length: 12 }, () => makeFinding({ ...rule, weight: 10 }, "triggered", "x"));
    expect(scoreFindings(heavy)).toBe(100);
  });

  it("does not let a reported authentication pass cancel a bank-detail change", () => {
    const result = evaluateMessage(message({
      subject: "Updated bank details",
      bodyText: "Please update our bank details before the next payment cycle.",
    }), baseline());
    expect(triggered(result, "BANK_CHANGE_REQUEST")).toBe(true);
    expect(triggered(result, "FIRST_BANK_CHANGE")).toBe(true);
    expect(triggered(result, "AUTH_SPF_FAIL")).toBe(false);
    expect(result.score).toBeGreaterThanOrEqual(50);
    expect(result.riskLevel).toBe("high");
    expect(result.recommendations[0]).toBe(BANK_CHANGE_RECOMMENDATION);
    expect(result.summary.toLowerCase()).not.toMatch(/\bfraud\b|\bprobability\b|\bsafe\b/);
  });

  it("surfaces a first bank change with no history and does not call that safe", () => {
    const result = evaluateMessage(message({
      bodyText: "Please update our bank details.",
    }), baseline({ maturity: "no_history", observations: [] }));
    expect(triggered(result, "FIRST_BANK_CHANGE")).toBe(true);
    expect(result.contextStatus).toBe("insufficient");
    expect(result.summary.toLowerCase()).not.toMatch(/\bsafe\b/);
    expect(result.recommendations.join(" ")).toContain("independent");
  });

  it("marks an unknown vendor as insufficient context", () => {
    const result = evaluateMessage(message({
      fromAddress: "ap@globex.example",
      fromDisplayName: "Globex Billing",
      senderDomain: "globex.example",
      authentication: { spf: "missing", dkim: "missing", dmarc: "missing", usable: false, sawHeader: false },
      observedSourceIps: [],
    }), baseline({ matchStatus: "unmatched", matchedBy: null, vendor: null, maturity: "no_history", observations: [] }));
    expect(result.contextStatus).toBe("insufficient");
    expect(result.riskLevel).toBe("low");
    expect(result.findings.some((finding) => finding.ruleId === "AUTH_RESULTS_MISSING" && finding.status === "unknown")).toBe(true);
  });

  it("triggers reply-to, auth failure, urgency, bypass, link, recipient, and time rules", () => {
    const reply = evaluateMessage(message({ replyToAddresses: ["payments@other.example"] }), baseline());
    expect(triggered(reply, "REPLY_TO_MISMATCH")).toBe(true);
    const auth = evaluateMessage(message({
      authentication: { spf: "fail", dkim: "fail", dmarc: "fail", usable: true, sawHeader: true },
    }), baseline());
    expect(triggered(auth, "AUTH_SPF_FAIL")).toBe(true);
    expect(triggered(auth, "AUTH_DKIM_FAIL")).toBe(true);
    expect(triggered(auth, "AUTH_DMARC_FAIL")).toBe(true);
    const rushed = evaluateMessage(message({
      toAddresses: ["outsider@external.example"],
      bodyText: "This payment is due today. Do not call the usual accounts team.",
      linkHosts: ["pay-now.example"],
      receivedAt: "2024-10-20T03:00:00.000Z",
    }), baseline());
    expect(triggered(rushed, "PAYMENT_URGENCY")).toBe(true);
    expect(triggered(rushed, "BYPASS_VERIFICATION")).toBe(true);
    expect(triggered(rushed, "SUSPICIOUS_LINK_HOST")).toBe(true);
    expect(triggered(rushed, "UNUSUAL_RECIPIENT")).toBe(true);
    expect(triggered(rushed, "UNUSUAL_SENDING_TIME")).toBe(true);
  });

  it("triggers the remaining identity and baseline rules", () => {
    const unknownSender = evaluateMessage(message({ fromAddress: "new@northwind.example" }), baseline({ matchedBy: "domain" }));
    expect(triggered(unknownSender, "UNKNOWN_SENDER_FOR_VENDOR")).toBe(true);
    const lookalike = evaluateMessage(message({
      fromAddress: "billing@northw1nd.example",
      senderDomain: "northw1nd.example",
      fromDisplayName: "Northwind Supplies",
    }), baseline({ matchStatus: "unmatched", matchedBy: null, vendor: null, maturity: "no_history", observations: [] }));
    expect(triggered(lookalike, "SENDER_DOMAIN_LOOKALIKE")).toBe(true);
    expect(triggered(lookalike, "DISPLAY_NAME_DOMAIN_CONFLICT")).toBe(true);
    const newIp = evaluateMessage(message({ observedSourceIps: ["198.51.100.44"] }), baseline());
    expect(triggered(newIp, "SOURCE_IP_NEW")).toBe(true);
    const novel = evaluateMessage(message({
      bodyText: "This payment is due today.",
    }), baseline());
    expect(triggered(novel, "UNUSUAL_REQUEST_CATEGORY")).toBe(true);
    const linksOnly = evaluateMessage(message({
      fromAddress: "ap@globex.example",
      senderDomain: "globex.example",
      linkHosts: ["files.example"],
    }), baseline({ matchStatus: "unmatched", matchedBy: null, vendor: null, maturity: "no_history", observations: [] }));
    expect(linksOnly.findings.some((finding) => finding.ruleId === "LINK_HOST_ONLY" && finding.status === "unknown")).toBe(true);
  });

  it("does not call a sending time unusual without five observations", () => {
    const result = evaluateMessage(message({ receivedAt: "2024-10-20T03:00:00.000Z" }), baseline({
      maturity: "limited",
      observations: baseline().observations.slice(0, 2),
    }));
    const time = result.findings.find((finding) => finding.ruleId === "UNUSUAL_SENDING_TIME");
    expect(time?.status).toBe("not_applicable");
  });

  it("hides quota and database failures behind a generic message", () => {
    const quota = toPublicError(new Error("D1_ERROR: quota exceeded while running SELECT secret_table"));
    expect(quota.status).toBe(503);
    expect(quota.message).not.toContain("SELECT");
    expect(quota.message).not.toContain("secret");
    const other = toPublicError(new Error("no such table: email_analyses"));
    expect(other.status).toBe(500);
    expect(other.message).not.toContain("email_analyses");
  });

  it("logs only the allowlisted request fields", () => {
    const lines: string[] = [];
    const original = console.log;
    console.log = (line: string) => lines.push(line);
    logRequest({ requestId: "abc", method: "POST", route: "/api/analyses", status: 201, durationMs: 4 });
    console.log = original;
    const logged = JSON.parse(lines[0] ?? "{}") as Record<string, unknown>;
    expect(Object.keys(logged).sort()).toEqual(["durationMs", "level", "method", "requestId", "route", "status"]);
  });
});
