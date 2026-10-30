import type { BaselineSnapshot, DetectionResult, NormalizedMessage } from "../../shared/types";
import { reportedAuthenticationPassed, evaluateAuthentication } from "./authentication";
import { evaluateBehavior } from "./behavior";
import { analyzeContent, evaluateContent } from "./content";
import { evaluateHeaders } from "./headers";
import { buildRecommendations, contextStatusFor, findingsToPersist, riskLevelForScore, scoreFindings } from "./score";

export function evaluateMessage(message: NormalizedMessage, baseline: BaselineSnapshot): DetectionResult {
  const findings = [
    ...evaluateAuthentication(message, baseline),
    ...evaluateHeaders(message, baseline),
    ...evaluateContent(message, baseline),
    ...evaluateBehavior(message, baseline),
  ];
  const score = scoreFindings(findings);
  const riskLevel = riskLevelForScore(score);
  const contextStatus = contextStatusFor(baseline);
  const recommendations = buildRecommendations(findings, contextStatus);
  const requestCategories = analyzeContent(message.subject, message.bodyText).categories;
  return {
    findings,
    persistedFindings: findingsToPersist(findings),
    score,
    riskLevel,
    contextStatus,
    summary: buildSummary(message, baseline, score, riskLevel, contextStatus, findings, requestCategories),
    recommendations,
    requestCategories,
  };
}

function buildSummary(
  message: NormalizedMessage,
  baseline: BaselineSnapshot,
  score: number,
  riskLevel: string,
  contextStatus: string,
  findings: DetectionResult["findings"],
  requestCategories: DetectionResult["requestCategories"],
): string {
  const triggered = findings.filter((finding) => finding.status === "triggered").map((finding) => finding.title);
  const lead = triggered.length
    ? `Heuristic score ${score} (${riskLevel}). Triggered signals: ${triggered.join("; ")}.`
    : `Heuristic score ${score} (${riskLevel}). No weighted detection rules triggered.`;
  const auth = reportedAuthenticationPassed(message.authentication)
    ? " Reported authentication results show pass. A reported pass does not establish that a payment change is legitimate."
    : "";
  const bank = requestCategories.includes("bank_detail_change")
    ? " Verify any bank-detail change through an independent channel already on file."
    : "";
  const context =
    contextStatus === "insufficient"
      ? " Historical context is insufficient, so a lower score is not evidence the message is legitimate."
      : contextStatus === "limited"
        ? " Only a limited vendor history is available; treat deviations cautiously."
        : baseline.matchStatus === "matched"
          ? " An established vendor history was available for comparison."
          : "";
  return `${lead}${auth}${bank}${context}`.replace(/\s+/g, " ").trim();
}
