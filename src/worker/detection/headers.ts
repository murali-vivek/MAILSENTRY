import { domainsRelated } from "../../shared/sanitize";
import type { BaselineSnapshot, FindingDraft, NormalizedMessage } from "../../shared/types";
import { makeFinding } from "./finding";
import { ruleById } from "./rules";

const STOP_WORDS = new Set([
  "billing",
  "invoice",
  "invoices",
  "accounts",
  "account",
  "payment",
  "payments",
  "payable",
  "vendor",
  "team",
  "support",
  "finance",
  "department",
  "services",
  "service",
  "company",
  "limited",
  "group",
  "office",
  "hello",
  "admin",
  "supplies",
  "supply",
  "partners",
  "solutions",
]);

function rule(id: string) {
  const found = ruleById(id);
  if (!found) throw new Error(`Missing rule ${id}`);
  return found;
}

function tokens(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 5 && !STOP_WORDS.has(token));
}

export function displayNameSuggests(displayName: string, vendorName: string): boolean {
  const vendorTokens = tokens(vendorName);
  const displayTokens = new Set(tokens(displayName));
  if (vendorTokens.length === 0) return false;
  const hits = vendorTokens.filter((token) => displayTokens.has(token));
  if (hits.length >= 2) return true;
  const longest = [...vendorTokens].sort((left, right) => right.length - left.length)[0];
  return Boolean(longest && longest.length >= 6 && displayTokens.has(longest));
}

function foldHomoglyph(label: string): string {
  return label.replace(/[01357@]/g, (character) => {
    const map: Record<string, string> = { "0": "o", "1": "l", "3": "e", "5": "s", "7": "t", "@": "a" };
    return map[character] ?? character;
  }).replaceAll("rn", "m");
}

function levenshteinAtMostOne(left: string, right: string): boolean {
  if (left === right) return false;
  if (Math.abs(left.length - right.length) > 1) return false;
  const previous = new Array<number>(right.length + 1);
  const current = new Array<number>(right.length + 1);
  for (let column = 0; column <= right.length; column += 1) previous[column] = column;
  for (let row = 1; row <= left.length; row += 1) {
    current[0] = row;
    let rowMin = current[0] ?? row;
    for (let column = 1; column <= right.length; column += 1) {
      const cost = left[row - 1] === right[column - 1] ? 0 : 1;
      const inserted = (current[column - 1] ?? 0) + 1;
      const deleted = (previous[column] ?? 0) + 1;
      const replaced = (previous[column - 1] ?? 0) + cost;
      const next = Math.min(inserted, deleted, replaced);
      current[column] = next;
      if (next < rowMin) rowMin = next;
    }
    if (rowMin > 1) return false;
    for (let column = 0; column <= right.length; column += 1) previous[column] = current[column] ?? 0;
  }
  return (previous[right.length] ?? 99) === 1;
}

export function isLookalikeDomain(candidate: string, known: string): boolean {
  if (candidate === known || candidate.endsWith(`.${known}`) || known.endsWith(`.${candidate}`)) return false;
  const candidateParts = candidate.split(".");
  const knownParts = known.split(".");
  if (candidateParts.length < 2 || knownParts.length < 2) return false;
  const candidateLabel = candidateParts[candidateParts.length - 2] ?? "";
  const knownLabel = knownParts[knownParts.length - 2] ?? "";
  const candidateTld = candidateParts[candidateParts.length - 1] ?? "";
  const knownTld = knownParts[knownParts.length - 1] ?? "";
  if (!candidateLabel || !knownLabel || candidateTld !== knownTld || candidateLabel === knownLabel) return false;
  if (candidateLabel.length < 5 || knownLabel.length < 5) return false;
  if (foldHomoglyph(candidateLabel) === foldHomoglyph(knownLabel)) return true;
  return levenshteinAtMostOne(candidateLabel, knownLabel);
}

export function evaluateHeaders(message: NormalizedMessage, baseline: BaselineSnapshot): FindingDraft[] {
  const findings: FindingDraft[] = [];
  const fromDomain = message.senderDomain;
  const replyRule = rule("REPLY_TO_MISMATCH");
  if (!fromDomain || message.replyToAddresses.length === 0) {
    findings.push(makeFinding(replyRule, "not_applicable", "The message has no From domain and Reply-To pair to compare."));
  } else {
    const vendorDomains = baseline.vendor?.domains ?? [];
    const mismatched = message.replyToAddresses
      .map((address) => address.split("@")[1] ?? "")
      .filter((domain) => domain && domain !== fromDomain)
      .filter((domain) => !(baseline.matchStatus === "matched" && domainsRelated(domain, vendorDomains)));
    if (mismatched.length > 0) {
      findings.push(
        makeFinding(
          replyRule,
          "triggered",
          `Reply-To domain ${mismatched[0]} differs from From domain ${fromDomain}.`,
        ),
      );
    } else {
      findings.push(makeFinding(replyRule, "not_triggered", "Reply-To domains match the From domain or a known vendor domain."));
    }
  }

  const senderRule = rule("UNKNOWN_SENDER_FOR_VENDOR");
  if (baseline.matchStatus !== "matched" || !baseline.vendor) {
    findings.push(makeFinding(senderRule, "not_applicable", "No single vendor match was available."));
  } else if (!message.fromAddress) {
    findings.push(makeFinding(senderRule, "unknown", "The message did not include a usable From address."));
  } else if (baseline.matchedBy === "address") {
    findings.push(makeFinding(senderRule, "not_triggered", "The exact sender address is on the vendor record."));
  } else if (!baseline.vendor.senderAddresses.includes(message.fromAddress)) {
    findings.push(
      makeFinding(
        senderRule,
        "triggered",
        `${message.fromAddress} matched ${baseline.vendor.displayName} by domain, and that address is not a known sender.`,
      ),
    );
  } else {
    findings.push(makeFinding(senderRule, "not_triggered", "The sender address is on the vendor record."));
  }

  const displayRule = rule("DISPLAY_NAME_DOMAIN_CONFLICT");
  if (!message.fromDisplayName || !message.senderDomain) {
    findings.push(makeFinding(displayRule, "not_applicable", "Display name or sender domain was not available."));
  } else {
    const conflict = baseline.directory.find(
      (vendor) => displayNameSuggests(message.fromDisplayName ?? "", vendor.displayName) && !domainsRelated(message.senderDomain ?? "", vendor.domains),
    );
    if (conflict) {
      findings.push(
        makeFinding(
          displayRule,
          "triggered",
          `Display name resembles ${conflict.displayName}, but the sender domain is ${message.senderDomain}.`,
        ),
      );
    } else {
      findings.push(makeFinding(displayRule, "not_triggered", "The display name does not conflict with a known vendor domain."));
    }
  }

  const lookalikeRule = rule("SENDER_DOMAIN_LOOKALIKE");
  if (!message.senderDomain) {
    findings.push(makeFinding(lookalikeRule, "not_applicable", "No sender domain was available."));
  } else {
    const knownDomains = baseline.directory.flatMap((vendor) => vendor.domains);
    if (domainsRelated(message.senderDomain, knownDomains)) {
      findings.push(makeFinding(lookalikeRule, "not_triggered", "The sender domain matches a known vendor domain."));
    } else {
      const lookalike = knownDomains.find((domain) => isLookalikeDomain(message.senderDomain ?? "", domain));
      if (lookalike) {
        findings.push(
          makeFinding(
            lookalikeRule,
            "triggered",
            `Sender domain ${message.senderDomain} resembles known domain ${lookalike}.`,
          ),
        );
      } else {
        findings.push(makeFinding(lookalikeRule, "not_triggered", "No conservative lookalike match was found."));
      }
    }
  }

  const ipRule = rule("SOURCE_IP_NEW");
  const primaryIp = message.observedSourceIps[0] ?? null;
  const seenIps = new Set(baseline.observations.flatMap((observation) => observation.sourceIps));
  if (baseline.matchStatus !== "matched" || baseline.maturity === "no_history") {
    findings.push(makeFinding(ipRule, "not_applicable", "A vendor baseline is required before a source address can be compared."));
  } else if (!primaryIp) {
    findings.push(makeFinding(ipRule, "unknown", "The headers did not include a usable source IP."));
  } else if (seenIps.size === 0) {
    findings.push(makeFinding(ipRule, "not_applicable", "Eligible history does not contain source addresses to compare."));
  } else if (!seenIps.has(primaryIp)) {
    findings.push(makeFinding(ipRule, "triggered", `Source address ${primaryIp} was not present in eligible vendor history.`));
  } else {
    findings.push(makeFinding(ipRule, "not_triggered", `Source address ${primaryIp} appears in eligible vendor history.`));
  }

  return findings;
}
