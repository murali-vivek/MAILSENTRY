import { sanitizeText } from "../../shared/sanitize";
import type { FindingDraft, FindingStatus, RuleDefinition } from "../../shared/types";

export function makeFinding(
  rule: RuleDefinition,
  status: FindingStatus,
  evidence: string,
): FindingDraft {
  return {
    ruleId: rule.id,
    category: rule.category,
    severity: rule.severity,
    title: rule.title,
    evidence: sanitizeText(evidence, 400) || "No additional evidence text.",
    explanation: rule.explanation,
    recommendation: rule.recommendation,
    limitation: rule.limitation,
    status,
    weight: status === "triggered" ? rule.weight : 0,
  };
}
