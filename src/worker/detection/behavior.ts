import { timeParts } from "../../shared/sanitize";
import type { BaselineSnapshot, FindingDraft, NormalizedMessage } from "../../shared/types";
import { analyzeContent } from "./content";
import { makeFinding } from "./finding";
import { ruleById } from "./rules";

function rule(id: string) {
  const found = ruleById(id);
  if (!found) throw new Error(`Missing rule ${id}`);
  return found;
}

export function evaluateBehavior(message: NormalizedMessage, baseline: BaselineSnapshot): FindingDraft[] {
  const signals = analyzeContent(message.subject, message.bodyText);
  const findings: FindingDraft[] = [];
  const bank = Boolean(signals.bankPhrase);
  const priorBank = baseline.observations.some((observation) => observation.isBankChangeRequest);
  if (!bank) {
    findings.push(makeFinding(rule("FIRST_BANK_CHANGE"), "not_applicable", "The message does not request a bank-detail change."));
  } else if (priorBank) {
    findings.push(makeFinding(rule("FIRST_BANK_CHANGE"), "not_triggered", "Eligible history already records a bank-detail change."));
  } else {
    findings.push(
      makeFinding(
        rule("FIRST_BANK_CHANGE"),
        "triggered",
        baseline.vendor
          ? `${baseline.vendor.displayName} has no eligible prior bank-detail change on record.`
          : "A bank-detail change was requested and there is no vendor history to compare.",
      ),
    );
  }

  const categoryRule = rule("UNUSUAL_REQUEST_CATEGORY");
  if (baseline.matchStatus !== "matched" || baseline.observations.length < 5) {
    findings.push(makeFinding(categoryRule, "not_applicable", "An established baseline of at least five observations is required."));
  } else {
    const historical = new Set(
      baseline.observations.flatMap((observation) => observation.categories).filter((category) => category !== "other"),
    );
    const current = signals.categories.filter((category) => category !== "other");
    const novel = current.filter((category) => !historical.has(category));
    if (historical.size === 0 || current.length === 0) {
      findings.push(makeFinding(categoryRule, "not_applicable", "There is no request category to compare with history."));
    } else if (novel.length > 0) {
      findings.push(makeFinding(categoryRule, "triggered", `Request category ${novel.join(", ")} was not in the established history.`));
    } else {
      findings.push(makeFinding(categoryRule, "not_triggered", "The request categories appear in the established history."));
    }
  }

  const recipientRule = rule("UNUSUAL_RECIPIENT");
  const knownRecipients = baseline.vendor?.internalRecipients ?? [];
  if (baseline.matchStatus !== "matched" || knownRecipients.length === 0) {
    findings.push(makeFinding(recipientRule, "not_applicable", "The matched vendor has no internal recipient list."));
  } else if (message.toAddresses.length === 0) {
    findings.push(makeFinding(recipientRule, "unknown", "The message did not include a usable To address."));
  } else if (message.toAddresses.some((address) => knownRecipients.includes(address))) {
    findings.push(makeFinding(recipientRule, "not_triggered", "At least one To address is on the vendor record."));
  } else {
    findings.push(makeFinding(recipientRule, "triggered", "None of the To addresses are recorded internal recipients."));
  }

  const timeRule = rule("UNUSUAL_SENDING_TIME");
  const { hour } = timeParts(message.receivedAt);
  const hours = baseline.observations
    .map((observation) => observation.hourOfDay)
    .filter((value): value is number => value !== null);
  if (baseline.matchStatus !== "matched" || baseline.observations.length < 5) {
    findings.push(makeFinding(timeRule, "not_applicable", "At least five eligible observations are required before a sending time is called unusual."));
  } else if (hour === null || hours.length < 5) {
    findings.push(makeFinding(timeRule, "not_applicable", "The message time or the historical hours are incomplete."));
  } else {
    const minimum = Math.min(...hours);
    const maximum = Math.max(...hours);
    if (hour < minimum || hour > maximum) {
      findings.push(
        makeFinding(timeRule, "triggered", `The message hour ${hour} UTC is outside the recorded range ${minimum}-${maximum} UTC.`),
      );
    } else {
      findings.push(makeFinding(timeRule, "not_triggered", `The message hour ${hour} UTC is inside the recorded range.`));
    }
  }

  return findings;
}
