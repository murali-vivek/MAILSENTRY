export const BANK_CHANGE_PHRASES = [
  "bank account",
  "bank details",
  "banking details",
  "banking information",
  "update our bank",
  "change our bank",
  "new bank",
  "payment account",
  "account number",
  "routing number",
  "wire instructions",
  "wire details",
  "iban",
  "swift code",
  "payment details have changed",
  "updated payment details",
  "remittance details",
] as const;

export const URGENCY_PHRASES = [
  "urgent",
  "urgently",
  "immediately",
  "as soon as possible",
  "asap",
  "overdue",
  "final notice",
  "payment is due",
  "due today",
  "within 24 hours",
  "within 48 hours",
  "right away",
  "time sensitive",
  "act now",
] as const;

export const BYPASS_PHRASES = [
  "do not contact",
  "don't contact",
  "do not call",
  "don't call",
  "do not verify",
  "don't verify",
  "skip verification",
  "no need to verify",
  "no need to call",
  "bypass",
  "do not confirm",
  "don't confirm",
  "without calling",
  "do not check with",
] as const;

export const INVOICE_PHRASES = [
  "invoice",
  "amount due",
  "remittance advice",
  "statement of account",
] as const;

const SHORT_WORD = new Set(["urgent", "urgently", "asap", "iban", "bypass", "overdue", "invoice"]);

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function findPhrase(text: string, phrases: readonly string[]): string | null {
  const haystack = text.toLowerCase();
  for (const phrase of phrases) {
    const needle = phrase.toLowerCase();
    if (SHORT_WORD.has(needle) || (!needle.includes(" ") && needle.length <= 12)) {
      const expression = new RegExp(`\\b${escapeRegExp(needle)}\\b`, "i");
      if (expression.test(haystack)) return phrase;
      continue;
    }
    if (haystack.includes(needle)) return phrase;
  }
  return null;
}

export function searchableText(subject: string | null, body: string): string {
  return `${subject ?? ""}\n${body}`.slice(0, 120_000);
}
