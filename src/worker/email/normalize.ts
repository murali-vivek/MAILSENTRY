import { domainOf } from "../../shared/sanitize";
import type { NormalizedMessage } from "../../shared/types";
import { parseAuthenticationResults } from "../detection/authentication";
import { analyzeContent } from "../detection/content";
import type { ParsedEmail } from "./parse";

export function normalizeEmail(parsed: ParsedEmail): NormalizedMessage {
  const receivedAt = parseMailDate(parsed.dateRaw);
  const authentication = parseAuthenticationResults(parsed.authenticationHeaders);
  const content = analyzeContent(parsed.subject, parsed.text);
  return {
    fromAddress: parsed.fromAddress,
    fromDisplayName: parsed.fromDisplayName,
    senderDomain: domainOf(parsed.fromAddress),
    replyToAddresses: parsed.replyTo,
    toAddresses: parsed.to,
    ccAddresses: parsed.cc,
    subject: parsed.subject,
    messageId: parsed.messageId,
    receivedAt,
    bodyText: parsed.text,
    bodyHtmlPresent: parsed.htmlPresent,
    linkHosts: parsed.linkHosts,
    observedSourceIps: parsed.sourceIps,
    authentication,
    requestCategories: content.categories,
  };
}

export function parseMailDate(value: string | null): string | null {
  if (!value) return null;
  const millis = Date.parse(value);
  if (Number.isNaN(millis)) return null;
  const iso = new Date(millis).toISOString();
  const year = Number(iso.slice(0, 4));
  if (year < 1990 || year > 2100) return null;
  return iso;
}
