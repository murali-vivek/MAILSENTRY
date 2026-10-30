import {
  BANK_CHANGE_RECOMMENDATION,
  INSUFFICIENT_CONTEXT_RECOMMENDATION,
} from "../../shared/constants";
import type { BaselineSnapshot, ContextStatus, FindingDraft, RiskLevel } from "../../shared/types";

export function scoreFindings(findings: FindingDraft[]): number {
  const total = findings
    .filter((finding) => finding.status === "triggered")
    .reduce((sum, finding) => sum + finding.weight, 0);
  return Math.max(0, Math.min(100, total));
}

export function riskLevelForScore(score: number): RiskLevel {
  if (score >= 40) return "high";
  if (score >= 20) return "medium";
  return "low";
}

export function contextStatusFor(baseline: BaselineSnapshot): ContextStatus {
  if (baseline.matchStatus !== "matched") return "insufficient";
  if (baseline.maturity === "no_history") return "insufficient";
  if (baseline.maturity === "limited") return "limited";
  return "sufficient";
}

const IMPORTANT_UNKNOWNS = new Set(["AUTH_RESULTS_MISSING", "LINK_HOST_ONLY"]);

export function findingsToPersist(findings: FindingDraft[]): FindingDraft[] {
  return findings.filter(
    (finding) => finding.status === "triggered" || (finding.status === "unknown" && IMPORTANT_UNKNOWNS.has(finding.ruleId)),
  );
}

export function buildRecommendations(findings: FindingDraft[], context: ContextStatus): string[] {
  const triggered = new Set(findings.filter((finding) => finding.status === "triggered").map((finding) => finding.ruleId));
  const ordered: string[] = [];
  const add = (text: string | undefined) => {
    if (text && !ordered.includes(text)) ordered.push(text);
  };
  if (triggered.has("BANK_CHANGE_REQUEST") || triggered.has("FIRST_BANK_CHANGE")) add(BANK_CHANGE_RECOMMENDATION);
  if (triggered.has("AUTH_SPF_FAIL") || triggered.has("AUTH_DKIM_FAIL") || triggered.has("AUTH_DMARC_FAIL")) {
    add("Verify the sender through a separate trusted channel and ask the mail administrator to inspect the authentication results.");
  }
  if (triggered.has("SUSPICIOUS_LINK_HOST") || findings.some((finding) => finding.ruleId === "LINK_HOST_ONLY" && finding.status === "unknown")) {
    add("Do not open the link from this message. Navigate using a known bookmark or verified vendor portal.");
  }
  if (context === "insufficient") add(INSUFFICIENT_CONTEXT_RECOMMENDATION);
  for (const finding of findings) {
    if (finding.status === "triggered") add(finding.recommendation);
  }
  if (ordered.length === 0) {
    add("Review the evidence before acting on a payment request. A lower score is a prioritization heuristic, not a verdict.");
  }
  return ordered.slice(0, 8);
}
