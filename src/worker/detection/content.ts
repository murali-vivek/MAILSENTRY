import type { ContentSignals, RequestCategory } from "../../shared/types";
import type { BaselineSnapshot, FindingDraft, NormalizedMessage } from "../../shared/types";
import { domainsRelated } from "../../shared/sanitize";
import { makeFinding } from "./finding";
import {
  BANK_CHANGE_PHRASES,
  BYPASS_PHRASES,
  INVOICE_PHRASES,
  URGENCY_PHRASES,
  findPhrase,
  searchableText,
} from "./phrases";
import { ruleById } from "./rules";

export function analyzeContent(subject: string | null, body: string): ContentSignals {
  const text = searchableText(subject, body);
  const bankPhrase = findPhrase(text, BANK_CHANGE_PHRASES);
  const urgencyPhrase = findPhrase(text, URGENCY_PHRASES);
  const bypassPhrase = findPhrase(text, BYPASS_PHRASES);
  const invoicePhrase = findPhrase(text, INVOICE_PHRASES);
  const categories: RequestCategory[] = [];
  if (invoicePhrase) categories.push("invoice");
  if (bankPhrase) categories.push("bank_detail_change");
  if (urgencyPhrase) categories.push("payment_urgency");
  if (categories.length === 0) categories.push("other");
  return { categories, bankPhrase, urgencyPhrase, bypassPhrase, invoicePhrase };
}

function rule(id: string) {
  const found = ruleById(id);
  if (!found) throw new Error(`Missing rule ${id}`);
  return found;
}

export function evaluateContent(message: NormalizedMessage, baseline: BaselineSnapshot): FindingDraft[] {
  const signals = analyzeContent(message.subject, message.bodyText);
  const findings: FindingDraft[] = [];
  findings.push(
    signals.bankPhrase
      ? makeFinding(rule("BANK_CHANGE_REQUEST"), "triggered", `Matched bank-detail phrase "${signals.bankPhrase}".`)
      : makeFinding(rule("BANK_CHANGE_REQUEST"), "not_triggered", "No bank-detail change phrase was matched."),
  );
  findings.push(
    signals.urgencyPhrase
      ? makeFinding(rule("PAYMENT_URGENCY"), "triggered", `Matched urgency phrase "${signals.urgencyPhrase}".`)
      : makeFinding(rule("PAYMENT_URGENCY"), "not_triggered", "No payment-urgency phrase was matched."),
  );
  findings.push(
    signals.bypassPhrase
      ? makeFinding(rule("BYPASS_VERIFICATION"), "triggered", `Matched verification-bypass phrase "${signals.bypassPhrase}".`)
      : makeFinding(rule("BYPASS_VERIFICATION"), "not_triggered", "No request to skip verification was matched."),
  );

  const hosts = message.linkHosts;
  const vendorDomains = baseline.vendor?.domains ?? [];
  const canCompare = baseline.matchStatus === "matched" && vendorDomains.length > 0;
  if (hosts.length === 0) {
    findings.push(makeFinding(rule("SUSPICIOUS_LINK_HOST"), "not_applicable", "No link host was extracted."));
    findings.push(makeFinding(rule("LINK_HOST_ONLY"), "not_applicable", "No link host was extracted."));
  } else if (canCompare) {
    const unrelated = hosts.filter((host) => !domainsRelated(host, vendorDomains));
    if (unrelated.length > 0) {
      findings.push(
        makeFinding(
          rule("SUSPICIOUS_LINK_HOST"),
          "triggered",
          `Link host ${unrelated.slice(0, 5).join(", ")} is not a known domain for the matched vendor.`,
        ),
      );
    } else {
      findings.push(makeFinding(rule("SUSPICIOUS_LINK_HOST"), "not_triggered", "Extracted link hosts match the vendor domain."));
    }
    findings.push(makeFinding(rule("LINK_HOST_ONLY"), "not_applicable", "Link hosts were compared with the matched vendor."));
  } else {
    findings.push(makeFinding(rule("SUSPICIOUS_LINK_HOST"), "not_applicable", "No matched vendor domain was available for comparison."));
    findings.push(
      makeFinding(
        rule("LINK_HOST_ONLY"),
        "unknown",
        `Link host ${hosts.slice(0, 5).join(", ")} was extracted and was not compared with a vendor domain.`,
      ),
    );
  }
  return findings;
}
