import type { HistoryEligibility, MatchStatus, RequestCategory, ReviewStatus } from "../../shared/types";

export function assessHistoryEligibility(input: {
  vendorMatchStatus: MatchStatus;
  vendorId: string | null;
  reviewStatus: ReviewStatus;
  requestCategories: RequestCategory[];
  inBaseline: boolean;
}): HistoryEligibility {
  const reasons: string[] = [];
  if (input.inBaseline) reasons.push("This analysis is already in the vendor baseline.");
  if (input.vendorMatchStatus !== "matched" || !input.vendorId) {
    reasons.push("The message is not matched to exactly one vendor.");
  }
  if (input.reviewStatus !== "benign_after_review") {
    reasons.push("Mark the analysis benign after review before adding it to vendor history.");
  }
  if (input.requestCategories.includes("bank_detail_change")) {
    reasons.push("Bank-detail change requests cannot be added to the baseline.");
  }
  return {
    eligible: reasons.length === 0,
    inBaseline: input.inBaseline,
    reasons,
  };
}
