import type { FindingDraft, FindingResponse } from "../../shared/types";
import { ruleById } from "../detection/rules";

export function toFindingResponse(draft: FindingDraft, id: string, createdAt: string): FindingResponse {
  const rule = ruleById(draft.ruleId);
  return {
    id,
    ruleId: draft.ruleId,
    category: draft.category,
    severity: draft.severity,
    title: draft.title,
    evidence: draft.evidence,
    explanation: draft.explanation,
    recommendation: draft.recommendation,
    limitation: rule?.limitation ?? draft.limitation,
    status: draft.status,
    weight: draft.weight,
    createdAt,
  };
}
