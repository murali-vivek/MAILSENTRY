import type { ParsedAuthentication } from "../../shared/types";

export function riskLabel(level: string): string {
  if (level === "high") return "High";
  if (level === "medium") return "Medium";
  if (level === "low") return "Low";
  return "Insufficient context";
}

export function contextLabel(status: string): string {
  if (status === "sufficient") return "Established history";
  if (status === "limited") return "Limited history";
  return "Insufficient context";
}

export function reviewLabel(status: string): string {
  if (status === "needs_verification") return "Needs verification";
  if (status === "benign_after_review") return "Benign after review";
  return "Unreviewed";
}

export function baselineLabel(status: string): string {
  if (status === "established") return "Established";
  if (status === "limited") return "Limited";
  return "No history";
}

export function formatAuth(auth: ParsedAuthentication): string {
  return `SPF ${auth.spf}, DKIM ${auth.dkim}, DMARC ${auth.dmarc}`;
}

export function splitList(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}
