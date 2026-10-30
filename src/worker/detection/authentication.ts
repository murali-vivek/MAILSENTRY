import type { AuthMethodResult, ParsedAuthentication } from "../../shared/types";
import type { BaselineSnapshot, FindingDraft, NormalizedMessage } from "../../shared/types";
import { makeFinding } from "./finding";
import { ruleById } from "./rules";

const METHOD_PATTERN = /\b(spf|dkim|dmarc)\s*=\s*([a-z0-9]+)/gi;

function classify(token: string): AuthMethodResult {
  const value = token.toLowerCase();
  if (value === "pass") return "pass";
  if (value === "fail" || value === "softfail") return "fail";
  if (value === "none" || value === "neutral") return "none";
  return "unknown";
}

function combine(values: AuthMethodResult[]): AuthMethodResult {
  if (values.length === 0) return "missing";
  if (values.includes("fail")) return "fail";
  if (values.includes("unknown")) return "unknown";
  if (values.every((item) => item === "pass")) return "pass";
  if (values.every((item) => item === "none")) return "none";
  return "unknown";
}

export function parseAuthenticationResults(headers: string[]): ParsedAuthentication {
  const collected: Record<"spf" | "dkim" | "dmarc", AuthMethodResult[]> = {
    spf: [],
    dkim: [],
    dmarc: [],
  };
  let sawHeader = false;
  for (const header of headers) {
    if (!header.trim()) continue;
    sawHeader = true;
    for (const match of header.matchAll(METHOD_PATTERN)) {
      const method = match[1]?.toLowerCase();
      const token = match[2];
      if ((method === "spf" || method === "dkim" || method === "dmarc") && token) {
        collected[method].push(classify(token));
      }
    }
  }
  const spf = combine(collected.spf);
  const dkim = combine(collected.dkim);
  const dmarc = combine(collected.dmarc);
  return {
    spf,
    dkim,
    dmarc,
    usable: [spf, dkim, dmarc].some((result) => result === "pass" || result === "fail"),
    sawHeader,
  };
}

export function reportedAuthenticationPassed(auth: ParsedAuthentication): boolean {
  const present = [auth.spf, auth.dkim, auth.dmarc].filter((result) => result !== "missing");
  return present.length > 0 && present.every((result) => result === "pass");
}

function authFinding(id: string, result: AuthMethodResult, label: string): FindingDraft {
  const rule = ruleById(id);
  if (!rule) throw new Error(`Missing rule ${id}`);
  if (result === "fail") {
    return makeFinding(rule, "triggered", `The imported header reports ${label} fail or softfail.`);
  }
  if (result === "pass") return makeFinding(rule, "not_triggered", `The imported header reports ${label} pass.`);
  if (result === "unknown") {
    return makeFinding(rule, "not_triggered", `The imported ${label} result is present but not a confident pass or fail.`);
  }
  return makeFinding(rule, "not_triggered", `No reported ${label} failure was found.`);
}

export function evaluateAuthentication(message: NormalizedMessage, _baseline: BaselineSnapshot): FindingDraft[] {
  const missing = ruleById("AUTH_RESULTS_MISSING");
  if (!missing) throw new Error("Missing AUTH_RESULTS_MISSING");
  const missingFinding = message.authentication.usable
    ? makeFinding(missing, "not_triggered", "At least one reported SPF, DKIM, or DMARC result was usable.")
    : makeFinding(
        missing,
        "unknown",
        message.authentication.sawHeader
          ? "Authentication headers were present but did not contain a usable pass or fail."
          : "The file did not include an Authentication-Results header.",
      );
  return [
    authFinding("AUTH_SPF_FAIL", message.authentication.spf, "SPF"),
    authFinding("AUTH_DKIM_FAIL", message.authentication.dkim, "DKIM"),
    authFinding("AUTH_DMARC_FAIL", message.authentication.dmarc, "DMARC"),
    missingFinding,
  ];
}
