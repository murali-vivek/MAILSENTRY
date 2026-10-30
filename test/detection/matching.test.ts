import { describe, expect, it } from "vitest";
import { sanitizeFilename, sanitizeText } from "../../src/shared/sanitize";
import { parseDomain, parseEmailAddress } from "../../src/shared/schemas";
import { parseAuthenticationResults } from "../../src/worker/detection/authentication";
import { displayNameSuggests, isLookalikeDomain } from "../../src/worker/detection/headers";
import { matchVendor } from "../../src/worker/vendor/matching";
import type { VendorDirectoryEntry } from "../../src/shared/types";

const northwind: VendorDirectoryEntry = {
  id: "v1",
  displayName: "Northwind Supplies",
  canonicalDomain: "northwind.example",
  senderAddresses: ["billing@northwind.example"],
  domains: ["northwind.example"],
  internalRecipients: ["accounts@acme-pay.example"],
};

describe("normalization and matching", () => {
  it("normalizes addresses and domains conservatively", () => {
    expect(parseEmailAddress("Billing@Northwind.example")).toBe("billing@northwind.example");
    expect(parseEmailAddress("not an email")).toBeNull();
    expect(parseDomain("Northwind.example.")).toBe("northwind.example");
    expect(parseDomain("https://northwind.example")).toBeNull();
  });

  it("matches exact address before domain and never uses display name", () => {
    expect(matchVendor("billing@northwind.example", "northwind.example", [northwind]).matchedBy).toBe("address");
    expect(matchVendor("new@northwind.example", "northwind.example", [northwind]).matchedBy).toBe("domain");
    expect(matchVendor("billing@other.example", "other.example", [northwind]).status).toBe("unmatched");
  });

  it("returns ambiguous when two vendors share an address", () => {
    const other = { ...northwind, id: "v2", senderAddresses: ["billing@northwind.example"] };
    expect(matchVendor("billing@northwind.example", "northwind.example", [northwind, other]).status).toBe("ambiguous");
  });

  it("parses absent, failed, softfail, and contradictory authentication headers", () => {
    expect(parseAuthenticationResults([]).usable).toBe(false);
    expect(parseAuthenticationResults(["spf=softfail"]).spf).toBe("fail");
    expect(parseAuthenticationResults(["this header is garbage"]).spf).toBe("missing");
    expect(parseAuthenticationResults(["spf=pass", "spf=fail"]).spf).toBe("fail");
    expect(parseAuthenticationResults(["spf=pass", "spf=temperror"]).spf).toBe("unknown");
  });

  it("flags conservative lookalikes and display-name conflicts", () => {
    expect(isLookalikeDomain("northw1nd.example", "northwind.example")).toBe(true);
    expect(isLookalikeDomain("northwind.example", "northwind.example")).toBe(false);
    expect(isLookalikeDomain("mail.northwind.example", "northwind.example")).toBe(false);
    expect(displayNameSuggests("Northwind Supplies Billing", "Northwind Supplies")).toBe(true);
    expect(displayNameSuggests("Accounts Payable", "Northwind Supplies")).toBe(false);
  });

  it("sanitizes filenames, subjects, and digit runs", () => {
    expect(sanitizeFilename("../../etc/passwd.eml")).toBe("passwd.eml");
    expect(sanitizeFilename("a".repeat(200) + ".eml").length).toBeLessThanOrEqual(120);
    expect(sanitizeText("account 12345678", 100)).toContain("[redacted-number]");
    expect(sanitizeText("<script>alert(1)</script>", 100)).not.toContain("<");
  });
});
